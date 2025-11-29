import { Construction } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DevelopmentPlaceholderProps {
  title: string;
  icon?: React.ReactNode;
}

export const DevelopmentPlaceholder = ({ title, icon }: DevelopmentPlaceholderProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {icon || <Construction className="h-16 w-16 text-muted-foreground" />}
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Esta funcionalidade está em desenvolvimento.
            <br />
            <span className="text-primary font-medium">Em breve!</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
