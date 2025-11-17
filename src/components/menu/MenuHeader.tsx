import { ArrowLeft, Heart, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MenuHeaderProps {
  onBack?: () => void;
  showSearch?: boolean;
  onSearchClick?: () => void;
}

export const MenuHeader = ({ onBack, showSearch = true, onSearchClick }: MenuHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/60 to-transparent px-4 py-3 flex items-center justify-between">
      <button
        onClick={handleBack}
        className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2">
        <button
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
        >
          <Heart className="w-5 h-5" />
        </button>
        {showSearch && (
          <button
            onClick={onSearchClick}
            className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
