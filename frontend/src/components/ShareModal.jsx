import { useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Mail, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { digits } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ShareModal({
  open, onOpenChange, title = "Share", messageUrl, text: textProp,
  phone: phoneProp, emailTemplate, emailRefId, emailVendorId,
}) {
  const [text, setText] = useState(textProp || "");
  const [phone, setPhone] = useState(phoneProp || "");
  const [shareUrl, setShareUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [emailErr, setEmailErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setText(textProp || "");
    setPhone(phoneProp || "");
    setShareUrl("");
    setPreview(null);
    if (messageUrl) {
      api.get(messageUrl).then((r) => {
        setText(r.data.text || "");
        setShareUrl(r.data.share_url || "");
        if (r.data.phone) setPhone(r.data.phone);
      }).catch((e) => toast.error(apiError(e)));
    }
  }, [open, messageUrl, textProp, phoneProp]);

  useEffect(() => {
    if (!open || !emailTemplate || !emailRefId) return;
    api
      .get("/email/preview", { params: { template: emailTemplate, ref_id: emailRefId, vendor_id: emailVendorId || undefined } })
      .then((r) => setPreview(r.data))
      .catch((e) => setPreview({ error: apiError(e) }));
  }, [open, emailTemplate, emailRefId, emailVendorId]);

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const sendEmail = async () => {
    setSending(true);
    setEmailErr("");
    try {
      const { data } = await api.post("/email/send", {
        template: emailTemplate, ref_id: emailRefId, vendor_id: emailVendorId || null,
      });
      toast.success(`Email sent to ${data.to}`);
      onOpenChange(false);
    } catch (e) {
      setEmailErr(apiError(e));
      toast.error(apiError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="share-modal">
        <DialogHeader>
          <DialogTitle className="font-heading">{title}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="whatsapp">
          <TabsList className="w-full">
            <TabsTrigger value="whatsapp" className="flex-1" data-testid="share-tab-whatsapp">
              <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
            </TabsTrigger>
            {emailTemplate && (
              <TabsTrigger value="email" className="flex-1" data-testid="share-tab-email">
                <Mail className="w-4 h-4 mr-1.5" /> Email
              </TabsTrigger>
            )}
            {shareUrl !== "" && (
              <TabsTrigger value="link" className="flex-1" data-testid="share-tab-link">
                <Copy className="w-4 h-4 mr-1.5" /> Link
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="whatsapp" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="wa-phone">Recipient WhatsApp number (with country code)</Label>
              <Input id="wa-phone" data-testid="share-wa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="919876543210" />
            </div>
            <div className="rounded-md border border-border bg-muted/50 p-3 max-h-56 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-xs font-mono text-foreground" data-testid="share-wa-preview">{text}</pre>
            </div>
            <Button className="w-full" asChild={Boolean(digits(phone))} disabled={!digits(phone)} data-testid="share-wa-open-btn">
              {digits(phone) ? (
                <a href={`https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" /> Open in WhatsApp
                </a>
              ) : (
                <span><ExternalLink className="w-4 h-4 mr-2" /> Open in WhatsApp</span>
              )}
            </Button>
          </TabsContent>

          {emailTemplate && (
            <TabsContent value="email" className="space-y-3 pt-3">
              {!preview && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading template…
                </div>
              )}
              {preview?.error && <p className="text-sm text-destructive" data-testid="share-email-preview-error">{preview.error}</p>}
              {preview && !preview.error && (
                <>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">To:</span> <span className="font-medium" data-testid="share-email-to">{preview.to}</span></p>
                    <p><span className="text-muted-foreground">Subject:</span> <span className="font-medium">{preview.subject}</span></p>
                  </div>
                  <div className="rounded-md border border-border max-h-56 overflow-y-auto" dangerouslySetInnerHTML={{ __html: preview.html }} data-testid="share-email-preview" />
                  <Button className="w-full" onClick={sendEmail} disabled={sending} data-testid="share-email-send-btn">
                    {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                    {sending ? "Sending…" : "Send email"}
                  </Button>
                  {emailErr && <p className="text-sm text-destructive" data-testid="share-email-error">{emailErr}</p>}
                </>
              )}
            </TabsContent>
          )}

          {shareUrl !== "" && (
            <TabsContent value="link" className="space-y-3 pt-3">
              <Label>Mobile-friendly proposal link</Label>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} data-testid="share-link-input" />
                <Button variant="outline" onClick={() => copy(shareUrl, "Link")} data-testid="share-link-copy-btn">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Customers can open this lightweight page on any phone — no app or PDF download needed.</p>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
