"""
中国象棋 - Streamlit交互式应用
使用Ollama LLM作为AI对手
"""
import streamlit as st
import os
import sys
from typing import Optional, Tuple

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from chess_game import ChineseChessBoard, ChessPiece
from ai_player import OllamaAIPlayer

# 页面配置
st.set_page_config(
    page_title="中国象棋",
    page_icon="♟️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# 自定义CSS样式
st.markdown("""
<style>
    .chess-board {
        display: inline-block;
        border: 3px solid #8B4513;
        background-color: #DEB887;
        padding: 10px;
        border-radius: 5px;
    }
    .chess-cell {
        width: 50px;
        height: 50px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
        border: 1px solid #8B4513;
        margin: 1px;
        border-radius: 5px;
    }
    .chess-cell:hover {
        background-color: #F5DEB3;
        box-shadow: 0 0 10px rgba(0,0,0,0.3);
    }
    .red-piece {
        color: #DC143C;
        text-shadow: 1px 1px 1px #000;
    }
    .black-piece {
        color: #000000;
        text-shadow: 1px 1px 1px #666;
    }
    .empty-cell {
        background-color: #F5DEB3;
    }
    .selected-cell {
        background-color: #90EE90 !important;
        box-shadow: 0 0 15px #32CD32;
    }
    .valid-move {
        background-color: #87CEEB !important;
    }
    .last-move {
        background-color: #FFD700 !important;
    }
    .river {
        text-align: center;
        font-size: 20px;
        color: #8B4513;
        font-weight: bold;
        background-color: #DEB887;
        padding: 5px;
        letter-spacing: 10px;
    }
</style>
""", unsafe_allow_html=True)

def init_session_state():
    """初始化会话状态"""
    if 'board' not in st.session_state:
        st.session_state.board = ChineseChessBoard()
    if 'selected_pos' not in st.session_state:
        st.session_state.selected_pos = None
    if 'game_over' not in st.session_state:
        st.session_state.game_over = False
    if 'winner' not in st.session_state:
        st.session_state.winner = None
    if 'ai_thinking' not in st.session_state:
        st.session_state.ai_thinking = False
    if 'move_history' not in st.session_state:
        st.session_state.move_history = []
    if 'last_move' not in st.session_state:
        st.session_state.last_move = None
    if 'player_color' not in st.session_state:
        st.session_state.player_color = 'red'
    if 'ai_player' not in st.session_state:
        st.session_state.ai_player = None
    if 'ai_model' not in st.session_state:
        st.session_state.ai_model = 'qwen2.5:7b'
    if 'ai_enabled' not in st.session_state:
        st.session_state.ai_enabled = True
    if 'ai_difficulty' not in st.session_state:
        st.session_state.ai_difficulty = 'medium'

def get_piece_display(piece: Optional[ChessPiece]) -> Tuple[str, str]:
    """获取棋子的显示字符和样式类"""
    if not piece:
        return "", "empty-cell"
    
    display_names = {
        '将': '将', '帅': '帅',
        '士': '士', '仕': '仕',
        '象': '象', '相': '相',
        '马': '马', '车': '车',
        '炮': '炮', '兵': '兵', '卒': '卒'
    }
    
    display = display_names.get(piece.name, piece.name)
    color_class = "red-piece" if piece.color == 'red' else "black-piece"
    
    return display, color_class

def render_board():
    """渲染棋盘"""
    board = st.session_state.board
    selected_pos = st.session_state.selected_pos
    last_move = st.session_state.last_move
    
    # 获取有效移动位置
    valid_moves = []
    if selected_pos:
        piece = board.get_piece(selected_pos[0], selected_pos[1])
        if piece:
            for row in range(10):
                for col in range(9):
                    if board.is_valid_move(piece, (row, col)):
                        valid_moves.append((row, col))
    
    # 构建棋盘HTML
    board_html = '<div class="chess-board">'
    
    for row in range(10):
        if row == 5:
            # 楚河汉界
            board_html += '<div class="river">楚 河 汉 界</div>'
        
        row_html = '<div style="display: flex;">'
        
        for col in range(9):
            piece = board.get_piece(row, col)
            display, color_class = get_piece_display(piece)
            
            # 确定单元格样式
            cell_class = "chess-cell"
            if selected_pos and selected_pos == (row, col):
                cell_class += " selected-cell"
            elif last_move and (row, col) in [last_move[0], last_move[1]]:
                cell_class += " last-move"
            elif (row, col) in valid_moves:
                cell_class += " valid-move"
            elif not piece:
                cell_class += " empty-cell"
            
            if piece:
                cell_class += f" {color_class}"
            
            # 创建按钮
            button_key = f"cell_{row}_{col}"
            
            # 使用列布局
            row_html += f'<div class="{cell_class}" id="{button_key}">{display}</div>'
        
        row_html += '</div>'
        board_html += row_html
    
    board_html += '</div>'
    
    return board_html

def handle_cell_click(row: int, col: int):
    """处理棋盘点击"""
    if st.session_state.game_over:
        return
    
    if st.session_state.ai_thinking:
        return
    
    board = st.session_state.board
    selected_pos = st.session_state.selected_pos
    player_color = st.session_state.player_color
    
    # 检查是否是玩家回合
    if board.current_player != player_color:
        return
    
    clicked_piece = board.get_piece(row, col)
    
    if selected_pos:
        # 已选中棋子，尝试移动
        selected_piece = board.get_piece(selected_pos[0], selected_pos[1])
        
        if clicked_piece and clicked_piece.color == player_color:
            # 点击自己的棋子，切换选择
            st.session_state.selected_pos = (row, col)
        elif board.is_valid_move(selected_piece, (row, col)):
            # 有效移动
            if board.move_piece(selected_pos, (row, col)):
                st.session_state.last_move = (selected_pos, (row, col))
                st.session_state.selected_pos = None
                
                # 记录移动
                move_desc = f"{'红方' if player_color == 'red' else '黑方'}: {selected_piece.name} ({selected_pos[0]},{selected_pos[1]}) → ({row},{col})"
                st.session_state.move_history.append(move_desc)
                
                # 检查游戏结束
                check_game_over()
                
                # 触发AI移动
                if not st.session_state.game_over and st.session_state.ai_enabled:
                    st.session_state.ai_thinking = True
                    st.rerun()
        else:
            # 无效移动，取消选择
            st.session_state.selected_pos = None
    else:
        # 未选中棋子，尝试选择
        if clicked_piece and clicked_piece.color == player_color:
            st.session_state.selected_pos = (row, col)

def check_game_over():
    """检查游戏是否结束"""
    board = st.session_state.board
    
    # 检查红方是否被将军
    if board.is_checkmate('red'):
        st.session_state.game_over = True
        st.session_state.winner = 'black'
        return
    
    # 检查黑方是否被将军
    if board.is_checkmate('black'):
        st.session_state.game_over = True
        st.session_state.winner = 'red'
        return
    
    # 检查是否无子可走
    red_moves = board.get_all_valid_moves('red')
    black_moves = board.get_all_valid_moves('black')
    
    if not red_moves:
        st.session_state.game_over = True
        st.session_state.winner = 'black'
    elif not black_moves:
        st.session_state.game_over = True
        st.session_state.winner = 'red'

def ai_move():
    """AI移动"""
    if not st.session_state.ai_player:
        st.session_state.ai_player = OllamaAIPlayer(model=st.session_state.ai_model)
        ai_color = 'black' if st.session_state.player_color == 'red' else 'red'
        st.session_state.ai_player.set_color(ai_color)
    
    ai_color = 'black' if st.session_state.player_color == 'red' else 'red'
    
    if st.session_state.board.current_player != ai_color:
        return
    
    # 根据难度选择方法
    if st.session_state.ai_difficulty == 'easy':
        # 简单难度：随机选择一个移动
        import random
        valid_moves = st.session_state.board.get_all_valid_moves(ai_color)
        if valid_moves:
            move = random.choice(valid_moves)
        else:
            move = None
    elif st.session_state.ai_difficulty == 'medium':
        # 中等难度：使用Minimax
        move = st.session_state.ai_player.get_best_move_minimax(st.session_state.board, depth=2)
    else:  # hard
        # 困难难度：使用LLM + Minimax
        move = st.session_state.ai_player.get_best_move_with_llm(st.session_state.board)
        if not move:
            move = st.session_state.ai_player.get_best_move_minimax(st.session_state.board, depth=3)
    
    if move:
        old_pos, new_pos = move
        piece = st.session_state.board.get_piece(old_pos[0], old_pos[1])
        
        if st.session_state.board.move_piece(old_pos, new_pos):
            st.session_state.last_move = (old_pos, new_pos)
            
            # 记录移动
            move_desc = f"{'红方' if ai_color == 'red' else '黑方'} AI: {piece.name} ({old_pos[0]},{old_pos[1]}) → ({new_pos[0]},{new_pos[1]})"
            st.session_state.move_history.append(move_desc)
            
            check_game_over()
    
    st.session_state.ai_thinking = False

def reset_game():
    """重置游戏"""
    st.session_state.board = ChineseChessBoard()
    st.session_state.selected_pos = None
    st.session_state.game_over = False
    st.session_state.winner = None
    st.session_state.ai_thinking = False
    st.session_state.move_history = []
    st.session_state.last_move = None
    if st.session_state.ai_player:
        ai_color = 'black' if st.session_state.player_color == 'red' else 'red'
        st.session_state.ai_player.set_color(ai_color)

def main():
    """主函数"""
    init_session_state()
    
    # 标题
    st.title("♟️ 中国象棋 - AI对战")
    st.markdown("### 使用Ollama本地LLM作为AI对手")
    
    # 侧边栏设置
    with st.sidebar:
        st.header("⚙️ 游戏设置")
        
        # 玩家颜色选择
        player_color = st.radio(
            "选择执棋颜色",
            options=['red', 'black'],
            format_func=lambda x: '红方（先手）' if x == 'red' else '黑方（后手）',
            key='player_color_radio'
        )
        
        if player_color != st.session_state.player_color:
            st.session_state.player_color = player_color
            reset_game()
        
        # AI设置
        st.subheader("AI设置")
        
        ai_enabled = st.checkbox("启用AI对手", value=st.session_state.ai_enabled)
        st.session_state.ai_enabled = ai_enabled
        
        if ai_enabled:
            ai_model = st.text_input(
                "Ollama模型名称",
                value=st.session_state.ai_model,
                help="输入你在Ollama中安装的模型名称，如: qwen2.5:7b, llama3.1等"
            )
            st.session_state.ai_model = ai_model
            
            ai_difficulty = st.selectbox(
                "AI难度",
                options=['easy', 'medium', 'hard'],
                format_func=lambda x: {'easy': '简单', 'medium': '中等', 'hard': '困难（LLM）'}[x],
                key='ai_difficulty_select'
            )
            st.session_state.ai_difficulty = ai_difficulty
            
            # 显示AI状态
            if st.session_state.ai_thinking:
                st.info("🤔 AI正在思考...")
        
        # 游戏控制
        st.subheader("游戏控制")
        
        if st.button("🔄 重新开始", use_container_width=True):
            reset_game()
        
        # 游戏状态
        st.subheader("游戏状态")
        current_player = st.session_state.board.current_player
        player_text = "红方" if current_player == 'red' else "黑方"
        st.write(f"当前回合: **{player_text}**")
        
        if st.session_state.game_over:
            winner_text = "红方" if st.session_state.winner == 'red' else "黑方"
            st.success(f"🏆 游戏结束！{winner_text}获胜！")
        
        # 移动历史
        st.subheader("移动历史")
        history_container = st.container()
        with history_container:
            if st.session_state.move_history:
                for move in st.session_state.move_history[-10:]:  # 只显示最近10步
                    st.text(move)
    
    # 主内容区
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        # 游戏状态提示
        if st.session_state.game_over:
            winner_text = "红方" if st.session_state.winner == 'red' else "黑方"
            st.error(f"🏆 游戏结束！{winner_text}获胜！")
        elif st.session_state.board.current_player != st.session_state.player_color:
            st.info("🤖 等待AI落子...")
        else:
            st.success("✅ 轮到你落子，请点击棋子")
        
        # 渲染棋盘（使用按钮网格）
        board_container = st.container()
        
        with board_container:
            # 创建棋盘网格
            for row in range(10):
                if row == 5:
                    st.markdown("---")
                    st.markdown("**楚 河 汉 界**")
                    st.markdown("---")
                
                cols = st.columns(9)
                for col in range(9):
                    with cols[col]:
                        piece = st.session_state.board.get_piece(row, col)
                        display, color_class = get_piece_display(piece)
                        
                        # 确定按钮样式
                        is_selected = st.session_state.selected_pos == (row, col)
                        is_last_move = st.session_state.last_move and (row, col) in [st.session_state.last_move[0], st.session_state.last_move[1]]
                        
                        # 获取有效移动
                        valid_moves = []
                        if st.session_state.selected_pos:
                            sel_piece = st.session_state.board.get_piece(
                                st.session_state.selected_pos[0], 
                                st.session_state.selected_pos[1]
                            )
                            if sel_piece:
                                for r in range(10):
                                    for c in range(9):
                                        if st.session_state.board.is_valid_move(sel_piece, (r, c)):
                                            valid_moves.append((r, c))
                        
                        is_valid_move = (row, col) in valid_moves
                        
                        # 按钮颜色
                        button_type = "secondary"
                        if is_selected:
                            button_type = "primary"
                        elif is_last_move:
                            button_type = "primary"
                        elif is_valid_move:
                            button_type = "secondary"
                        
                        # 显示棋子
                        if piece:
                            button_label = f"{display}"
                            if piece.color == 'red':
                                button_label = f"🔴{display}"
                            else:
                                button_label = f"⚫{display}"
                        else:
                            button_label = "·"
                        
                        # 创建按钮
                        if st.button(
                            button_label,
                            key=f"btn_{row}_{col}",
                            type=button_type,
                            use_container_width=True
                        ):
                            handle_cell_click(row, col)
        
        # AI移动处理
        if st.session_state.ai_thinking and st.session_state.ai_enabled:
            ai_move()
            st.rerun()
    
    # 说明文档
    with st.expander("📖 游戏说明"):
        st.markdown("""
        ### 如何玩
        1. 在侧边栏选择你执棋的颜色（红方先手）
        2. 点击你的棋子选中它（绿色高亮）
        3. 点击目标位置移动棋子
        4. AI会自动回应
        
        ### 棋子走法
        - **将/帅**: 只能在九宫内移动，每次一步
        - **士/仕**: 只能在九宫内斜走
        - **象/相**: 走田字，不能过河，会被塞象眼
        - **马**: 走日字，会被蹩马腿
        - **车**: 直线移动，不限步数
        - **炮**: 直线移动，吃子需要翻山（跳过一个棋子）
        - **兵/卒**: 未过河只能前进，过河后可左右移动
        
        ### AI设置
        - **简单**: 随机走棋
        - **中等**: 使用Minimax算法
        - **困难**: 使用Ollama LLM分析局面
        
        ### Ollama配置
        确保已安装并运行Ollama服务：
        ```bash
        ollama serve
        ollama pull qwen2.5:7b
        ```
        """)

if __name__ == "__main__":
    main()