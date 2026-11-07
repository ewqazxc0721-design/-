# 训练增强功能的第三方来源

本次导入固定于 openGym 提交 `8fb98b16861a2728652302a7e6e30c50548493a0`。上游作者为 Duarte Santos。

- `训练动作库/upstream-opengym.json` 保存本次核对使用的原始动作文本元数据。每个动作原有的 `textSource` 等字段保留。
- `训练动作库/actions.json` 中新增、对照修订的中文动作内容记录上游 ID、固定提交、原始文件地址与审校说明。
- openGym 自有代码和文本使用 AGPL。原始 ExerciseDB 文本的 MIT 来源及其适用范围，以保留的上游 NOTICE 为准。
- 本次没有导入、提取、热链或重绘 openGym/Gym visual 的动作图片和动画。新增动作没有精确配图时显示文字占位。
- 人体区域图是本项目新绘制的简化 SVG，内联在 `training-ui.js`，没有复制上游 MuscleMap 或 openGym 人体路径。
- `training-core.js`、`training-ui.js` 和样式为本项目实现，没有引入 React、Zustand、Vite 或 openGym 后端。
- 原有 `gifs/` 素材保留其原始来源记录。对应关系不完全一致的条目标为轨迹参考；文件存在不代表本次重新核实了其授权。

保留的上游文件：

- [AGPL 原文](../licenses/opengym-AGPL-3.0.txt)
- [完整上游 NOTICE，含 ExerciseDB MIT 声明及媒体限制](../licenses/opengym-NOTICE.md)
- [固定版本的动作目录说明](https://github.com/DuarteSantos8/openGym/blob/8fb98b16861a2728652302a7e6e30c50548493a0/catalogue/README.md)

本地运行及修改方式：从现有项目根目录通过静态 HTTP 服务提供页面，修改上述源文件后运行功能副本生成器和相关检查。所用源码与数据随更新包提供。
