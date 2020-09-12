# colive

基于 CRDT 的 VSCode 实时协作文本编辑插件。

## 功能

- 自动处理并发修改带来的冲突，保持结果在客户端的一致性。
- 支持对整个操作历史的撤销和重做。
- 显示其他客户端的光标位置。

## 仓库结构

```
├── client // Language Client
│   ├── src
│   │   └── extension.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        └── server.ts // Language Server entry point
```

## 调试与运行

- 在该文件夹执行 `npm install` 。
- 用 VSCode 打开该文件夹。
- 按 F5 运行并选择 Client + Server ，即可运行该插件。
- 运行插件后，点击左侧插件栏的纸飞机图标。
- 点击 enter 按钮，右下角窗口会出现用户 ID 。
- 第一个 enter 的用户将会获得 admin 身份，admin 用户准备好文档（plain text 类型）后，点击 connect。
- admin 用户 connect 成功后，其他用户可以点击 connect 从而获得 admin 用户的文档内容。
- 之后就可以开始协作编辑了，如果要断开连接，请点击 disconnect 。

## 其他

- [dev 分支](https://github.com/OSH-2020/x-oslove/tree/dev/colive) 有一个测试版本的插件，用相同的方法可以启动两个 VSCode 插件主机，如果只有一台电脑，可以使用该版本进行测试。注意：要修改 extension.ts 中的一个绝对地址。

- 测试的时候如果出现不同步的情况，可能是渲染的问题，当进行新的操作时会自动同步。