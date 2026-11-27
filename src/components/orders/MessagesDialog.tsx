"use client";

import { MessageCircle, RotateCcw } from "lucide-react";
import { useStore } from "@/lib/store";
import { DEFAULT_MESSAGES, MESSAGE_FIELDS, ORDER_MESSAGES, messageTemplate } from "@/lib/orderMessages";
import type { OrderMessageKey } from "@/lib/types";
import { Modal } from "../Modal";
import { Button, Textarea } from "../ui";

/** The shop's own WhatsApp wording for each order situation (approved, shipped…). Saves as you type. */
export function MessagesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { shop, setShop } = useStore();
  const set = (key: OrderMessageKey, text: string | null) => {
    const messages = { ...shop.messages };
    if (text === null || text === DEFAULT_MESSAGES[key]) delete messages[key];
    else messages[key] = text;
    setShop({ ...shop, messages });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      icon={<MessageCircle className="size-5" />}
      title="Customer messages"
      subtitle="The WhatsApp message for each step of an order. Changes save automatically."
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-canvas p-3 text-[12.5px] text-body">
          <p className="mb-1.5 font-semibold">These words fill in from the order:</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {MESSAGE_FIELDS.map((f) => (
              <span key={f.tag}>
                <code className="rounded bg-white px-1 font-mono text-[12px] font-bold text-brand">{f.tag}</code> {f.what}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-muted">A line whose words are all empty (no coupon, no tracking yet) is left out. Put *stars* around words for bold on WhatsApp.</p>
        </div>
        {ORDER_MESSAGES.map((m) => {
          const own = !!shop.messages?.[m.key]?.trim();
          return (
            <section key={m.key}>
              <div className="mb-1.5 flex items-end gap-2">
                <div className="mr-auto">
                  <h3 className="text-[14px] font-bold">{m.label}</h3>
                  <p className="text-[12px] text-muted">{m.hint}</p>
                </div>
                {own && (
                  <Button variant="ghost" size="sm" onClick={() => set(m.key, null)}>
                    <RotateCcw className="size-3.5" /> Default
                  </Button>
                )}
              </div>
              <Textarea rows={6} className="text-[13px]" value={messageTemplate(shop.messages, m.key)} onChange={(e) => set(m.key, e.target.value)} />
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
