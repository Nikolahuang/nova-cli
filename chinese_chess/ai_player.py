"""
Ollama AI 玩家
"""
import requests
import json
from typing import List, Tuple, Optional
from chess_game import ChineseChessBoard, ChessPiece

class OllamaAIPlayer:
    """使用Ollama LLM的AI玩家"""
    
    def __init__(self, model: str = "qwen2.5:7b", base_url: str = "http://localhost:11434"):
        self.model = model
        self.base_url = base_url
        self.color = 'black'  # AI默认执黑
    
    def set_color(self, color: str):
        """设置AI执棋颜色"""
        self.color = color
    
    def get_piece_value(self, piece: ChessPiece) -> int:
        """获取棋子价值"""
        values = {
            '将': 10000, '帅': 10000,
            '车': 900,
            '马': 400,
            '炮': 450,
            '象': 200, '相': 200,
            '士': 200, '仕': 200,
            '卒': 100, '兵': 100
        }
        return values.get(piece.name, 0)
    
    def evaluate_board(self, board: ChineseChessBoard) -> int:
        """评估棋盘局面"""
        score = 0
        for row in range(10):
            for col in range(9):
                piece = board.get_piece(row, col)
                if piece:
                    value = self.get_piece_value(piece)
                    # 位置加成
                    if piece.name in ['兵', '卒']:
                        # 过河的兵卒更有价值
                        if piece.color == 'red' and row < 5:
                            value += 50
                        elif piece.color == 'black' and row > 4:
                            value += 50
                    
                    if piece.color == self.color:
                        score += value
                    else:
                        score -= value
        
        # 检查将军状态
        if board.is_checkmate(self.color):
            score -= 5000
        
        return score
    
    def get_move_description(self, board: ChineseChessBoard, move: Tuple[Tuple[int, int], Tuple[int, int]]) -> str:
        """获取移动的描述"""
        old_pos, new_pos = move
        piece = board.get_piece(old_pos[0], old_pos[1])
        if not piece:
            return ""
        
        # 列号转换（0-8 -> 一-九）
        col_names_red = ['九', '八', '七', '六', '五', '四', '三', '二', '一']
        col_names_black = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
        
        if piece.color == 'red':
            from_col = col_names_red[old_pos[1]]
            to_col = col_names_red[new_pos[1]]
        else:
            from_col = col_names_black[old_pos[1]]
            to_col = col_names_black[new_pos[1]]
        
        # 移动类型
        dy = new_pos[0] - old_pos[0]
        dx = new_pos[1] - old_pos[1]
        
        if piece.color == 'red':
            dy = -dy  # 红方视角
        
        move_type = ""
        if dy > 0:
            move_type = "进"
        elif dy < 0:
            move_type = "退"
        elif dx != 0:
            move_type = "平"
        
        # 构建移动描述
        if move_type == "平":
            return f"{piece.name}{from_col}平{to_col}"
        elif move_type in ["进", "退"]:
            if piece.name in ['马', '象', '相']:
                return f"{piece.name}{from_col}{move_type}{to_col}"
            else:
                distance = abs(dy) if dy != 0 else abs(dx)
                return f"{piece.name}{from_col}{move_type}{distance}"
        
        return f"{piece.name}从{old_pos}到{new_pos}"
    
    def get_best_move_with_llm(self, board: ChineseChessBoard) -> Optional[Tuple[Tuple[int, int], Tuple[int, int]]]:
        """使用LLM选择最佳移动"""
        # 获取所有合法移动
        valid_moves = board.get_all_valid_moves(self.color)
        
        if not valid_moves:
            return None
        
        # 先用启发式方法筛选出几个较好的移动
        scored_moves = []
        for move in valid_moves:
            old_pos, new_pos = move
            
            # 模拟移动
            test_board = board.copy()
            test_board.move_piece(old_pos, new_pos)
            
            # 评估
            score = self.evaluate_board(test_board)
            
            # 吃子加分
            target = board.get_piece(new_pos[0], new_pos[1])
            if target:
                score += self.get_piece_value(target) * 2
            
            scored_moves.append((move, score))
        
        # 排序并选择前5个候选移动
        scored_moves.sort(key=lambda x: x[1], reverse=True)
        top_moves = scored_moves[:5]
        
        # 构建LLM提示
        board_state = board.get_board_state()
        move_descriptions = []
        for i, (move, score) in enumerate(top_moves):
            desc = self.get_move_description(board, move)
            target = board.get_piece(move[1][0], move[1][1])
            capture_info = f"，可吃{target.name}" if target else ""
            move_descriptions.append(f"{i+1}. {desc}{capture_info} (评估分: {score})")
        
        prompt = f"""你是一个中国象棋专家。现在是{'红方' if board.current_player == 'red' else '黑方'}回合。
你是{'黑方' if self.color == 'black' else '红方'}。

当前棋盘状态（从上到下，从左到右，格式：颜色_棋子名，--表示空位）：
{board_state}

以下是经过初步评估的几个较好的移动选项：
{chr(10).join(move_descriptions)}

请分析局面，选择最佳移动。回复格式：选择数字（1-5），并简要说明理由。

回复示例：
选择：3
理由：这一步可以吃掉对方的车，获得较大优势。

请直接回复，不要有多余内容。"""

        try:
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                llm_response = result.get('response', '')
                
                # 解析LLM的选择
                import re
                match = re.search(r'选择[：:]\s*(\d+)', llm_response)
                if match:
                    choice = int(match.group(1))
                    if 1 <= choice <= len(top_moves):
                        return top_moves[choice - 1][0]
        except Exception as e:
            print(f"LLM调用失败: {e}")
        
        # 如果LLM失败，返回评分最高的移动
        return top_moves[0][0] if top_moves else None
    
    def get_best_move_minimax(self, board: ChineseChessBoard, depth: int = 2) -> Optional[Tuple[Tuple[int, int], Tuple[int, int]]]:
        """使用Minimax算法选择最佳移动（带Alpha-Beta剪枝）"""
        valid_moves = board.get_all_valid_moves(self.color)
        
        if not valid_moves:
            return None
        
        best_move = None
        best_score = float('-inf')
        alpha = float('-inf')
        beta = float('inf')
        
        for move in valid_moves:
            test_board = board.copy()
            test_board.move_piece(move[0], move[1])
            score = self._minimax(test_board, depth - 1, alpha, beta, False)
            
            if score > best_score:
                best_score = score
                best_move = move
            
            alpha = max(alpha, score)
        
        return best_move
    
    def _minimax(self, board: ChineseChessBoard, depth: int, alpha: float, beta: float, 
                  is_maximizing: bool) -> int:
        """Minimax算法递归函数"""
        if depth == 0:
            return self.evaluate_board(board)
        
        current_color = self.color if is_maximizing else ('red' if self.color == 'black' else 'black')
        valid_moves = board.get_all_valid_moves(current_color)
        
        if not valid_moves:
            return self.evaluate_board(board)
        
        if is_maximizing:
            max_eval = float('-inf')
            for move in valid_moves[:10]:  # 限制搜索宽度
                test_board = board.copy()
                test_board.move_piece(move[0], move[1])
                eval_score = self._minimax(test_board, depth - 1, alpha, beta, False)
                max_eval = max(max_eval, eval_score)
                alpha = max(alpha, eval_score)
                if beta <= alpha:
                    break
            return max_eval
        else:
            min_eval = float('inf')
            for move in valid_moves[:10]:
                test_board = board.copy()
                test_board.move_piece(move[0], move[1])
                eval_score = self._minimax(test_board, depth - 1, alpha, beta, True)
                min_eval = min(min_eval, eval_score)
                beta = min(beta, eval_score)
                if beta <= alpha:
                    break
            return min_eval