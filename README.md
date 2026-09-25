# 归真纪元 v1.2 界面资源

本仓库只放界面运行所需的 CSS、JavaScript 和开局背景图。世界书、聊天、密钥和历史备份不在这里。

`dist/` 由 `scripts/build.mjs` 从同级的 `v1.2/` 最新导入 JSON 生成。脚本会核对三个输入文件的 SHA-256；输入改变时先审查差异，再更新校验值，避免从旧稿重建。

```powershell
node scripts/build.mjs
```

上传到公开 GitHub 仓库后，用提交编号生成候选导入件：

```powershell
node scripts/build.mjs ..\v1.2 https://cdn.jsdelivr.net/gh/OWNER/gzjy-card-assets@COMMIT/dist
```

候选件写入同级 `gzjy-cdn-candidate/`。正式导入前，先确认 CDN 返回的文件与 `build-manifest.json` 哈希一致，并在实际 SillyTavern 中测试开局、状态栏、手机、聊天切换和断网状态。发布时使用固定提交编号；更新资源时生成新候选件，不移动旧提交。
