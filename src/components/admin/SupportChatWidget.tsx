import { useState } from "react";
import { Headphones, MessageCircle, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SupportChatWidget = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {open && (
        <div className="mb-3 bg-card border border-border rounded-lg shadow-lg w-72 p-4 space-y-3 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Suporte</h4>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Como podemos ajudar?</p>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-sm"
              onClick={() => window.open("https://wa.me/5516995868928?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20sistema", "_blank")}
            >
              <MessageCircle className="w-4 h-4 text-green-600" />
              Falar via WhatsApp
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 text-sm"
              onClick={() => window.open("mailto:suporte@menus.com.br?subject=Suporte%20-%20Sistema", "_blank")}
            >
              <Mail className="w-4 h-4 text-blue-600" />
              Enviar e-mail
            </Button>
          </div>
        </div>
      )}
      <Button
        onClick={() => setOpen(!open)}
        className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
        size="icon"
      >
        {open ? <X className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
      </Button>
    </div>
  );
};
