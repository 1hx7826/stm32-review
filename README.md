# STM32 标准库复习网站

适用 STM32F103C8T6，学习 STM32F10x 标准外设库。11 章、88 个知识点、124 个函数索引；首批 16 篇讲解、16 道题与 16 张卡片。未完成的内容明确标记，函数官方 SPL 发行包比对及代码例仍待核验。

## 本地启动

使用 Node.js 24 LTS。在仓库根目录进入 web-app：

```sh
cd web-app
npm ci
npm run dev
```

开发地址 http://127.0.0.1:5173/。配置不会改变浏览器的 v1 学习数据格式。

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

生产预览地址 http://127.0.0.1:4173/stm32-review/。已有端口占用时，可添加 -- --port 4176。不要把 dist、node_modules、缓存或个人导出文件加入仓库。

## GitHub Pages

工作流 .github/workflows/deploy.yml 仅支持 main 分支上的 workflow_dispatch。当前配置准备完成不代表已上线。首次发布必须经维护者确认；在 Settings → Pages → Build and deployment → Source 选择 GitHub Actions，再在 Actions 手动运行工作流。无需个人访问令牌。

预定路径 https://<GitHub用户名>.github.io/stm32-review/。仓库更名时，在 web-app/vite.config.ts 修改生产 base，并更新本说明中的路径，然后重跑测试/构建。现有 Hash 路由以 #/library 等形式导航，不需要额外 404 路由文件。

## 数据隐私

无需账号登录；学习记录保存在当前浏览器的 IndexedDB，主题保存在 localStorage。应用没有学习数据上传、云同步或分析追踪接口。来源链接仅在用户点击后访问。

GitHub Pages 不提供电脑和手机的进度同步；用 JSON 导出/导入。不同设备、浏览器、域名、端口属于不同存储环境；迁移前先导出，导入必须先校验和预览，替换需明确确认。浏览器清理站点数据会删除本地记录。

## 测试与内容边界

原有 80 项回归保留。旧 v1 导入用固定合成 TypeScript 夹具，未提交个人学习 JSON 或历史 QA 备份。生成内容来自同级 content/；必须保留该目录。src/generated/ 可由构建脚本重建。

知识说明、题干、解释和调用片段为本项目原创整理；来源只保留引用信息。仓库不附第三方文章、截图、ST 头文件/实现或官方 PDF。请阅读 NOTICE.md 与 THIRD_PARTY_NOTICES.txt。未擅自给整个项目添加开源许可证；维护者应在正式公开前确认原创权属和许可选择。
