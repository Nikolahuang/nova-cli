"""
中国象棋核心逻辑
"""
from typing import List, Tuple, Optional, Dict
import copy

class ChessPiece:
    """棋子类"""
    def __init__(self, name: str, color: str, position: Tuple[int, int]):
        self.name = name  # 棋子名称：将、士、象、马、车、炮、兵
        self.color = color  # 颜色：red（红方）或 black（黑方）
        self.position = position  # 位置：(row, col)
    
    def __repr__(self):
        return f"{self.color}_{self.name}"

class ChineseChessBoard:
    """中国象棋棋盘类"""
    def __init__(self):
        self.board = [[None for _ in range(9)] for _ in range(10)]
        self.current_player = 'red'
        self.move_history = []
        self.init_board()
    
    def init_board(self):
        """初始化棋盘"""
        # 黑方（上方）
        self.board[0][0] = ChessPiece('车', 'black', (0, 0))
        self.board[0][1] = ChessPiece('马', 'black', (0, 1))
        self.board[0][2] = ChessPiece('象', 'black', (0, 2))
        self.board[0][3] = ChessPiece('士', 'black', (0, 3))
        self.board[0][4] = ChessPiece('将', 'black', (0, 4))
        self.board[0][5] = ChessPiece('士', 'black', (0, 5))
        self.board[0][6] = ChessPiece('象', 'black', (0, 6))
        self.board[0][7] = ChessPiece('马', 'black', (0, 7))
        self.board[0][8] = ChessPiece('车', 'black', (0, 8))
        self.board[2][1] = ChessPiece('炮', 'black', (2, 1))
        self.board[2][7] = ChessPiece('炮', 'black', (2, 7))
        for i in [0, 2, 4, 6, 8]:
            self.board[3][i] = ChessPiece('卒', 'black', (3, i))
        
        # 红方（下方）
        self.board[9][0] = ChessPiece('车', 'red', (9, 0))
        self.board[9][1] = ChessPiece('马', 'red', (9, 1))
        self.board[9][2] = ChessPiece('相', 'red', (9, 2))
        self.board[9][3] = ChessPiece('仕', 'red', (9, 3))
        self.board[9][4] = ChessPiece('帅', 'red', (9, 4))
        self.board[9][5] = ChessPiece('仕', 'red', (9, 5))
        self.board[9][6] = ChessPiece('相', 'red', (9, 6))
        self.board[9][7] = ChessPiece('马', 'red', (9, 7))
        self.board[9][8] = ChessPiece('车', 'red', (9, 8))
        self.board[7][1] = ChessPiece('炮', 'red', (7, 1))
        self.board[7][7] = ChessPiece('炮', 'red', (7, 7))
        for i in [0, 2, 4, 6, 8]:
            self.board[6][i] = ChessPiece('兵', 'red', (6, i))
    
    def get_piece(self, row: int, col: int) -> Optional[ChessPiece]:
        """获取指定位置的棋子"""
        if 0 <= row < 10 and 0 <= col < 9:
            return self.board[row][col]
        return None
    
    def is_valid_move(self, piece: ChessPiece, new_pos: Tuple[int, int]) -> bool:
        """检查移动是否有效"""
        if not (0 <= new_pos[0] < 10 and 0 <= new_pos[1] < 9):
            return False
        
        target = self.get_piece(new_pos[0], new_pos[1])
        if target and target.color == piece.color:
            return False
        
        return self._check_piece_rule(piece, new_pos)
    
    def _check_piece_rule(self, piece: ChessPiece, new_pos: Tuple[int, int]) -> bool:
        """检查各棋子的移动规则"""
        old_pos = piece.position
        dx = new_pos[1] - old_pos[1]
        dy = new_pos[0] - old_pos[0]
        
        if piece.name in ['将', '帅']:
            # 将帅只能在九宫内移动
            if piece.color == 'black':
                if not (0 <= new_pos[0] <= 2 and 3 <= new_pos[1] <= 5):
                    return False
            else:
                if not (7 <= new_pos[0] <= 9 and 3 <= new_pos[1] <= 5):
                    return False
            return abs(dx) + abs(dy) == 1
        
        elif piece.name in ['士', '仕']:
            # 士仕只能在九宫内斜走
            if piece.color == 'black':
                if not (0 <= new_pos[0] <= 2 and 3 <= new_pos[1] <= 5):
                    return False
            else:
                if not (7 <= new_pos[0] <= 9 and 3 <= new_pos[1] <= 5):
                    return False
            return abs(dx) == 1 and abs(dy) == 1
        
        elif piece.name in ['象', '相']:
            # 象相走田字，不能过河
            if piece.color == 'black':
                if new_pos[0] > 4:
                    return False
            else:
                if new_pos[0] < 5:
                    return False
            
            if abs(dx) == 2 and abs(dy) == 2:
                # 检查象眼
                mid_row = old_pos[0] + dy // 2
                mid_col = old_pos[1] + dx // 2
                if self.get_piece(mid_row, mid_col) is not None:
                    return False
                return True
            return False
        
        elif piece.name == '马':
            # 马走日字
            if (abs(dx), abs(dy)) in [(1, 2), (2, 1)]:
                # 检查蹩马腿
                if abs(dx) == 2:
                    block_col = old_pos[1] + dx // 2
                    if self.get_piece(old_pos[0], block_col) is not None:
                        return False
                else:
                    block_row = old_pos[0] + dy // 2
                    if self.get_piece(block_row, old_pos[1]) is not None:
                        return False
                return True
            return False
        
        elif piece.name == '车':
            # 车走直线
            if dx == 0 or dy == 0:
                return self._check_path_clear(old_pos, new_pos)
            return False
        
        elif piece.name == '炮':
            # 炮走直线，吃子需要翻山
            if dx == 0 or dy == 0:
                target = self.get_piece(new_pos[0], new_pos[1])
                pieces_between = self._count_pieces_between(old_pos, new_pos)
                if target:
                    return pieces_between == 1
                else:
                    return pieces_between == 0
            return False
        
        elif piece.name in ['兵', '卒']:
            # 兵卒前进
            if piece.color == 'red':
                # 红方兵向上走
                if old_pos[0] <= 4:  # 过河后可以横走
                    return (dy == -1 and dx == 0) or (dy == 0 and abs(dx) == 1)
                else:
                    return dy == -1 and dx == 0
            else:
                # 黑方卒向下走
                if old_pos[0] >= 5:  # 过河后可以横走
                    return (dy == 1 and dx == 0) or (dy == 0 and abs(dx) == 1)
                else:
                    return dy == 1 and dx == 0
        
        return False
    
    def _check_path_clear(self, old_pos: Tuple[int, int], new_pos: Tuple[int, int]) -> bool:
        """检查路径上是否有棋子"""
        dx = new_pos[1] - old_pos[1]
        dy = new_pos[0] - old_pos[0]
        
        step_x = 0 if dx == 0 else (1 if dx > 0 else -1)
        step_y = 0 if dy == 0 else (1 if dy > 0 else -1)
        
        curr_x, curr_y = old_pos[1] + step_x, old_pos[0] + step_y
        while (curr_y, curr_x) != new_pos:
            if self.get_piece(curr_y, curr_x) is not None:
                return False
            curr_x += step_x
            curr_y += step_y
        return True
    
    def _count_pieces_between(self, old_pos: Tuple[int, int], new_pos: Tuple[int, int]) -> int:
        """计算两点之间的棋子数量"""
        dx = new_pos[1] - old_pos[1]
        dy = new_pos[0] - old_pos[0]
        
        step_x = 0 if dx == 0 else (1 if dx > 0 else -1)
        step_y = 0 if dy == 0 else (1 if dy > 0 else -1)
        
        count = 0
        curr_x, curr_y = old_pos[1] + step_x, old_pos[0] + step_y
        while (curr_y, curr_x) != new_pos:
            if self.get_piece(curr_y, curr_x) is not None:
                count += 1
            curr_x += step_x
            curr_y += step_y
        return count
    
    def move_piece(self, old_pos: Tuple[int, int], new_pos: Tuple[int, int]) -> bool:
        """移动棋子"""
        piece = self.get_piece(old_pos[0], old_pos[1])
        if not piece or piece.color != self.current_player:
            return False
        
        if not self.is_valid_move(piece, new_pos):
            return False
        
        # 执行移动
        target = self.board[new_pos[0]][new_pos[1]]
        self.board[new_pos[0]][new_pos[1]] = piece
        self.board[old_pos[0]][old_pos[1]] = None
        piece.position = new_pos
        
        # 记录历史
        self.move_history.append({
            'piece': piece,
            'from': old_pos,
            'to': new_pos,
            'captured': target
        })
        
        # 切换玩家
        self.current_player = 'black' if self.current_player == 'red' else 'red'
        return True
    
    def get_all_valid_moves(self, color: str) -> List[Tuple[Tuple[int, int], Tuple[int, int]]]:
        """获取某方所有可能的移动"""
        moves = []
        for row in range(10):
            for col in range(9):
                piece = self.get_piece(row, col)
                if piece and piece.color == color:
                    for new_row in range(10):
                        for new_col in range(9):
                            if self.is_valid_move(piece, (new_row, new_col)):
                                moves.append(((row, col), (new_row, new_col)))
        return moves
    
    def is_checkmate(self, color: str) -> bool:
        """检查是否被将军"""
        # 找到将/帅的位置
        king_pos = None
        for row in range(10):
            for col in range(9):
                piece = self.get_piece(row, col)
                if piece and piece.color == color and piece.name in ['将', '帅']:
                    king_pos = (row, col)
                    break
        
        if not king_pos:
            return True  # 将/帅被吃，判负
        
        # 检查对方所有棋子是否能攻击到将/帅
        opponent = 'black' if color == 'red' else 'red'
        for row in range(10):
            for col in range(9):
                piece = self.get_piece(row, col)
                if piece and piece.color == opponent:
                    if self.is_valid_move(piece, king_pos):
                        return True
        return False
    
    def get_board_state(self) -> str:
        """获取棋盘状态字符串"""
        state = []
        for row in range(10):
            row_str = []
            for col in range(9):
                piece = self.board[row][col]
                if piece:
                    row_str.append(f"{piece.color[0]}{piece.name}")
                else:
                    row_str.append("--")
            state.append(" ".join(row_str))
        return "\n".join(state)
    
    def copy(self):
        """复制棋盘"""
        new_board = ChineseChessBoard()
        new_board.board = [[None for _ in range(9)] for _ in range(10)]
        for row in range(10):
            for col in range(9):
                piece = self.board[row][col]
                if piece:
                    new_board.board[row][col] = ChessPiece(piece.name, piece.color, piece.position)
        new_board.current_player = self.current_player
        return new_board