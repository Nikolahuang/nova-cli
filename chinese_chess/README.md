# 中国象棋 - AI对战游戏

使用Streamlit开发的中国象棋游戏，集成Ollama本地LLM作为AI对手。

## 功能特点

- 🎮 **交互式棋盘**: 通过点击进行下棋
- 🤖 **AI对手**: 集成Ollama本地LLM进行AI决策
- 🎯 **三种难度**: 
  - 简单：随机走棋
  - 中等：Minimax算法（深度2）
  - 困难：LLM分析 + Minimax算法（深度3）
- 🔄 **完整规则**: 实现了中国象棋的所有规则
- 📊 **移动历史**: 记录并显示移动历史

## 安装

### 1. 安装依赖

```bash
cd chinese_chess
pip install -r requirements.txt
```

### 2. 安装Ollama

访问 [Ollama官网](https://ollama.ai/) 下载并安装Ollama。

### 3. 下载模型

```bash
# 下载Qwen2.5模型（推荐）
ollama pull qwen2.5:7b

# 或使用其他模型
ollama pull llama3.1
ollama pull mistral
```

### 4. 启动Ollama服务

```bash
ollama serve
```

## 运行游戏

```bash
streamlit run app.py
```

然后在浏览器中打开 http://localhost:8501

## 游戏玩法

1. **选择执棋颜色**: 在侧边栏选择红方（先手）或黑方（后手）
2. **选择AI难度**: 根据你的水平选择合适的难度
3. **下棋**: 
   - 点击你的棋子选中它（会高亮显示）
   - 点击目标位置移动棋子
   - 可移动的位置会用蓝色标记
4. **AI回应**: AI会自动分析并做出回应

## 棋子规则

| 棋子 | 走法 |
|------|------|
| 将/帅 | 只能在九宫内移动，每次一步 |
| 士/仕 | 只能在九宫内斜走 |
| 象/相 | 走田字，不能过河，会被塞象眼 |
| 马 | 走日字，会被蹩马腿 |
| 车 | 直线移动，不限步数 |
| 炮 | 直线移动，吃子需要翻山 |
| 兵/卒 | 未过河只能前进，过河后可左右移动 |

## 技术架构

```
chinese_chess/
├── app.py              # Streamlit主应用
├── chess_game.py       # 棋盘和棋子逻辑
├── ai_player.py        # AI玩家（Minimax + LLM）
├── requirements.txt    # Python依赖
└── README.md          # 说明文档
```

## AI实现

### Minimax算法
- 使用Alpha-Beta剪枝优化
- 棋子价值评估
- 位置加成评估

### LLM集成
- 使用Ollama API调用本地模型
- LLM分析候选移动
- 结合启发式评估选择最佳移动

## 自定义

### 修改AI模型

在侧边栏的"Ollama模型名称"中输入你安装的模型名称。

### 修改搜索深度

在 `ai_player.py` 中修改：

```python
# 中等难度
move = ai_player.get_best_move_minimax(board, depth=2)

# 困难难度
move = ai_player.get_best_move_minimax(board, depth=3)
```

## 常见问题

### Q: AI不响应怎么办？
A: 确保Ollama服务正在运行，并已下载相应模型。

### Q: 如何查看AI的思考过程？
A: 在控制台中可以看到AI的决策日志。

### Q: 游戏卡住了怎么办？
A: 刷新页面或点击"重新开始"按钮。

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request！