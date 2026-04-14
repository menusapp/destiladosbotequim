import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface MenuHeaderProps {
  showSearch?: boolean;
  onSearchClick?: () => void;
  searchOpen?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSearchClose?: () => void;
}

export const MenuHeader = ({ 
  showSearch = true, 
  onSearchClick, 
  searchOpen = false,
  searchQuery = "",
  onSearchChange,
  onSearchClose
}: MenuHeaderProps) => {
  return (
    <div
      data-menu-header
      className="fixed top-0 left-0 right-0 z-50 pointer-events-none bg-gradient-to-b from-black/60 to-transparent px-4 py-3"
    >
      {searchOpen ? (
        <div className="flex items-center gap-2 pointer-events-auto">
          <Input
            autoFocus
            type="text"
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="flex-1 bg-white/90 backdrop-blur-sm border-none"
          />
          <button
            onClick={onSearchClose}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-end pointer-events-auto">
          {showSearch && (
            <button
              onClick={onSearchClick}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
