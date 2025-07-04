
# picgo-plugin-imgbox

> 用于 [PicGo](https://github.com/Molunerfinn/PicGo) 的 [Imgbox](https://imgbox.com/) 图床插件。

![NPM Version](https://img.shields.io/npm/v/picgo-plugin-imgbox) ![GitHub License](https://img.shields.io/github/license/aquausora/picgo-plugin-imgbox)

## 插件设置

* `认证 Cookie`：登录状态下上传使用，需要手动获取。
* `相册标题`：上传图片到新建相册（受限于api，不支持上传到既有相册）。
* `内容类型`：R18 内容标签（`safe` 或 `private`）。
* `启用评论`：是否允许评论。
* `缩略图尺寸`：分为 `c`（裁剪）及 `r`（圆角）两类。

## 获取认证 Cookie

1.  使用浏览器登录 [https://imgbox.com/](https://imgbox.com/)。

2.  按 `F12` 打开开发者工具。

3.  切换到 `Network`（网络）标签页。

4.  刷新页面。

5.  在网络请求列表中，找到任意一个 Imgbox 域名的请求（例如 `imgbox.com`）。

6.  点击该请求，找到右侧面板 `Headers`（标头）中的 `Request Headers`（请求标头）部分，复制 `set-cookie` 中从 `_imgbox_session=` 开头，到第一个分号结束（不包括分号）的字段。

    ![](https://raw.githubusercontent.com/arifvn/imgbox-js/refs/heads/main/cookie.png)

## 注意事项

* 认证 Cookie 具有时效性。如果上传失败或遇到认证问题，请尝试重新获取。
* Imgbox 没有公开的 API 文档，本插件基于第三方 api [imgbox-js](https://github.com/arifvn/imgbox-js) 实现，因而不支持上传到既有相册（即便是指定了既有相册的标题，Imgbox 也会创建一个同名的新相册）。

## 鸣谢

  * [PicGo](https://github.com/Molunerfinn/PicGo)
  * [imgbox-js](https://github.com/arifvn/imgbox-js)