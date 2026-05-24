import { Link } from 'react-router-dom';
import { gameArt } from './gameArt';

export interface GameCardData {
  id: string;
  name: string;
  route: string;
  tag: string;
  description: string;
}

// Dashboard game tile. Shows only real, verifiable info: the game name, a
// category tag, and a one-line description. The prototype's fabricated
// "1,284 playing" counts and its doubled LIVE dot are intentionally dropped.
export function VaultGameCard({ game }: { game: GameCardData }) {
  const Art = gameArt[game.id];
  return (
    <Link to={game.route} className="game-card">
      <div className={`banner banner-${game.id}`}>{Art && <div className="icon-art"><Art /></div>}</div>
      <div className="meta">
        <div className="name">
          <span>{game.name}</span>
          <span className="tag-chip">{game.tag}</span>
        </div>
        <div className="stats">
          <span className="desc">{game.description}</span>
        </div>
      </div>
    </Link>
  );
}
