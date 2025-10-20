interface NotificationBadgeProps {
  show: boolean;
}

export const NotificationBadge = ({ show }: NotificationBadgeProps) => {
  if (!show) return null;
  
  return (
    <span className="absolute top-1 right-1 h-2 w-2 bg-orange-500 rounded-full" />
  );
};
