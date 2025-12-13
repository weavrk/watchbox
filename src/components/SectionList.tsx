import type { WatchBoxItem } from '../types';
import { TitleCard } from './TitleCard';

interface SectionListProps {
  title: string;
  items: WatchBoxItem[];
  onDelete: (id: string) => void;
  onMove: (id: string, newListType: 'top' | 'watch') => void;
}

const EmptyStateIllustration = () => (
  <svg width="142" height="163" viewBox="0 0 142 163" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M116.278 30C116.278 28.5555 115.994 27.1251 115.441 25.7905C114.888 24.4559 114.078 23.2433 113.057 22.2218C112.035 21.2004 110.823 20.3901 109.488 19.8373C108.153 19.2845 106.723 19 105.278 19C103.834 19 102.404 19.2845 101.069 19.8373C99.7344 20.3901 98.5217 21.2004 97.5003 22.2218C96.4789 23.2433 95.6686 24.4559 95.1158 25.7905C94.563 27.1251 94.2785 28.5555 94.2785 30L105.278 30H116.278Z" fill="var(--gray-300)"/>
    <line x1="104.925" y1="21.6321" x2="83.6464" y2="0.353575" stroke="var(--gray-300)"/>
    <line y1="-0.5" x2="30.0923" y2="-0.5" transform="matrix(0.707107 -0.707107 -0.707107 -0.707107 105.278 21.2785)" stroke="var(--gray-300)"/>
    <path d="M13 154H129V159C129 161.209 127.209 163 125 163H17C14.7909 163 13 161.209 13 159V154Z" fill="var(--gray-300)"/>
    <path d="M130 33C136.627 33 142 38.3726 142 45V139C142 145.627 136.627 151 130 151H12C5.37258 151 0 145.627 0 139V45C1.67512e-06 38.3726 5.37258 33 12 33H130ZM16 41C11.5817 41 8 44.5817 8 49V125C8 129.418 11.5817 133 16 133H92C96.4183 133 100 129.418 100 125V49C100 44.5817 96.4183 41 92 41H16ZM126.5 63C122.358 63 119 66.3579 119 70.5C119 74.6421 122.358 78 126.5 78C130.642 78 134 74.6421 134 70.5C134 66.3579 130.642 63 126.5 63ZM126.5 41C122.358 41 119 44.3579 119 48.5C119 52.6421 122.358 56 126.5 56C130.642 56 134 52.6421 134 48.5C134 44.3579 130.642 41 126.5 41Z" fill="var(--gray-300)"/>
  </svg>
);

export function SectionList({ title, items, onDelete, onMove }: SectionListProps) {
  return (
    <div className="section-list">
      <h2 className="section-title">{title}</h2>
      <div className="cards-grid">
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-illustration">
              <EmptyStateIllustration />
            </div>
            <h3 className="empty-state-title">Your {title} is empty</h3>
            <p className="empty-state-message">Start adding titles to build your collection</p>
          </div>
        ) : (
          items.map((item) => (
            <TitleCard
              key={item.id}
              item={item}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </div>
  );
}

