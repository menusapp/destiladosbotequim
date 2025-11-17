import { Search } from "lucide-react";

interface MenuHeaderProps {
  showSearch?: boolean;
  onSearchClick?: () => void;
}

export const MenuHeader = ({ showSearch = true, onSearchClick }: MenuHeaderProps) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/60 to-transparent px-4 py-3 flex items-center justify-end">
      {showSearch && (
        <button
          onClick={onSearchClick}
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
