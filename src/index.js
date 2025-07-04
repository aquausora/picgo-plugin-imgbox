const { imgbox } = require('imgbox-js');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

module.exports = (ctx) => {
  // 定义插件的配置项
  const config = () => {
    return [
      {
        name: 'authCookie',
        type: 'input',
        default: '',
        required: false,
        message: 'Imgbox 认证 Cookie（可选，用于登录用户上传）',
        alias: '认证 Cookie',
        validate: (input) => {
          if (input && typeof input !== 'string') {
            return '认证 Cookie 必须是字符串';
          }
          return true;
        }
      },
      {
        name: 'albumTitle',
        type: 'input',
        default: '',
        required: false,
        message: 'Imgbox 相册标题（可选，仅用于创建新相册）',
        alias: '相册标题'
      },
      {
        name: 'contentType',
        type: 'list',
        default: 'safe',
        choices: ['safe', 'private'],
        message: '内容类型',
        alias: '内容类型'
      },
      {
        name: 'commentsEnabled',
        type: 'confirm',
        default: true,
        message: '启用评论',
        alias: '启用评论'
      },
      {
        name: 'thumbnailSize',
        type: 'list',
        default: '350c', // 默认值保持 350c
        // --- 关键修改：只保留带有裁剪/圆角标识的尺寸 ---
        choices: ['original', '100c', '150c', '250c', '300c', '350c', '500c', '800c', '100r', '150r', '250r', '300r', '350r', '500r', '800r'],
        // --- 修改结束 ---
        message: '缩略图尺寸',
        alias: '缩略图尺寸'
      }
    ];
  };

  // 注册上传器
  const register = () => {
    ctx.helper.uploader.register('imgbox', {
      handle: async (uploader) => {
        const tempFiles = [];
        try {
          const imgList = uploader.output;

          const imgboxConfig = ctx.getConfig('picgo-plugin-imgbox') || {};
          ctx.log.info(`[Imgbox Plugin] Current Imgbox Config: ${JSON.stringify(imgboxConfig)}`);

          const authCookie = imgboxConfig.authCookie;
          if (!authCookie) {
              ctx.log.warn('[Imgbox Plugin] authCookie is NOT set in imgboxConfig! Uploads may fail or be unreliable for private albums/features.');
          } else {
              ctx.log.info(`[Imgbox Plugin] authCookie IS set (length: ${authCookie.length}, startsWith: ${authCookie.substring(0, 10)}...)`);
          }

          const albumTitle = imgboxConfig.albumTitle;

          if (albumTitle) {
            ctx.log.info(`[Imgbox Plugin] Attempting to create or use album with title: ${albumTitle}`);
          } else {
            ctx.log.info('[Imgbox Plugin] No album title provided. Uploading to default album or creating unnamed album.');
          }

          const uploadPromises = imgList.map(async (img) => {
            if (!img.buffer && !img.base64Str) {
              ctx.log.error(`[Imgbox Plugin] Image data is missing for ${img.fileName}.`);
              throw new Error(`Image data is missing for ${img.fileName}.`);
            }

            const tempFileName = `${path.basename(img.fileName || 'temp_image', path.extname(img.fileName || '.png'))}-${Date.now()}${path.extname(img.fileName || '.png')}`;
            const tempFilePath = path.join(os.tmpdir(), tempFileName);

            try {
              await fs.writeFile(tempFilePath, img.buffer);
              tempFiles.push(tempFilePath);
              ctx.log.info(`[Imgbox Plugin] Saving temporary file: ${tempFilePath}`);
            } catch (writeErr) {
              ctx.log.error(`[Imgbox Plugin] Failed to write temporary file ${tempFilePath}: ${writeErr.message}`);
              throw new Error(`Failed to save image to temp file: ${writeErr.message}`);
            }

            const imgboxOptions = {
              auth_cookie: authCookie || '',
              album_title: albumTitle || '',
              content_type: imgboxConfig.contentType || 'safe',
              comments_enabled: imgboxConfig.commentsEnabled !== false,
              thumbnail_size: imgboxConfig.thumbnailSize || '350c',
              logger: ctx.log.debug
            };

            ctx.log.info(`[Imgbox Plugin] Uploading image ${img.fileName} to Imgbox...`);
            let res;
            try {
                res = await imgbox(tempFilePath, imgboxOptions);
            } catch (imgboxErr) {
                ctx.log.error(`[Imgbox Plugin] imgbox-js threw an error during upload for ${img.fileName}: ${imgboxErr.message}`);
                throw new Error(`Imgbox upload failed: ${imgboxErr.message}`);
            }

            // 详细错误日志捕获
            if (res && res.data && Array.isArray(res.data) && res.data.length > 0 && res.data[0] && res.data[0].error) {
                ctx.log.error(`[Imgbox Plugin] API Error for ${img.fileName}: ${res.data[0].error}. Full response data for this image: ${JSON.stringify(res.data[0], null, 2)}`);
            } else if (res && (!res.data || res.data.length === 0)) {
                ctx.log.warn(`[Imgbox Plugin] Unexpected empty data array for ${img.fileName}. Full raw response: ${JSON.stringify(res, null, 2)}`);
            }

            ctx.log.debug(`[Imgbox Plugin] Raw imgbox-js response for ${img.fileName}: ${JSON.stringify(res, null, 2)}`);

            if (res && res.data && Array.isArray(res.data) && res.data.length > 0 && res.data[0] && res.data[0].original_url) {
              const uploadedUrl = res.data[0].original_url;
              img.imgUrl = uploadedUrl;
              ctx.log.info(`[Imgbox Plugin] Image ${img.fileName} uploaded successfully. URL: ${uploadedUrl}`);
            } else {
              let errorMessage = `Imgbox upload failed for ${img.fileName}: No original_url returned or unexpected response.`;

              if (res && res.data && Array.isArray(res.data) && res.data.length > 0 && res.data[0]) {
                if (res.data[0].error) {
                  errorMessage = `Imgbox upload failed for ${img.fileName}: Imgbox API Error: ${res.data[0].error}. 请检查Cookie是否正确或相册标题是否有效。`;
                } else {
                  errorMessage = `Imgbox upload failed for ${img.fileName}: 收到异常响应结构: ${JSON.stringify(res.data[0])}`;
                }
              } else if (res) {
                 errorMessage = `Imgbox upload failed for ${img.fileName}: Imgbox API 返回异常响应 (缺少/空 'data' 数组): ${JSON.stringify(res)}`;
              }
              ctx.log.error(`[Imgbox Plugin] ${errorMessage}`);
              throw new Error(errorMessage);
            }
          });

          await Promise.all(uploadPromises);

          return uploader;
        } catch (err) {
          ctx.log.error(`[Imgbox Plugin] An error occurred during upload process: ${err.message}`);
          ctx.emit('notification', {
            title: 'Imgbox 上传失败',
            body: err.message,
            text: '请检查 PicGo 日志获取更多信息'
          });
          throw err;
        } finally {
          for (const filePath of tempFiles) {
            try {
              await fs.unlink(filePath);
              ctx.log.info(`[Imgbox Plugin] Cleaned up temporary file: ${filePath}`);
            } catch (cleanupErr) {
              ctx.log.warn(`[Imgbox Plugin] Failed to clean up temporary file ${filePath}: ${cleanupErr.message}`);
            }
          }
        }
      },
      name: 'Imgbox'
    });
  };

  return {
    uploader: 'imgbox',
    register,
    config
  };
};