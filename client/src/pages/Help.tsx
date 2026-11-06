import { Link } from "wouter";
import { StoreLayout } from "@/components/store/StoreLayout";
import { trpc } from "@/_core/trpc";

type Section = { heading: string; body: string[] };

const CONTENT: Record<string, { title: string; intro: string; sections: Section[] }> = {
  payments: {
    title: "Payments & bank transfer",
    intro: "MarketHub takes payment by direct bank transfer. There is no card gateway — you transfer, then tell us the reference.",
    sections: [
      {
        heading: "How it works",
        body: [
          "Place your order and you'll land on a payment instructions page with our bank details and your unique order number.",
          "Transfer the exact total from your bank app, using your order number as the transfer narration where your bank allows it.",
          "Come back to the order and submit the transaction reference. Your order moves to Payment Verification.",
          "A member of our team checks the reference against our account, then approves it. Only then is the order marked Paid.",
        ],
      },
      {
        heading: "How long does verification take?",
        body: [
          "Verification is done by hand during business hours, usually within a few hours. You'll get an in-app notification the moment it's approved or if we need a corrected reference.",
        ],
      },
      {
        heading: "If your reference is rejected",
        body: [
          "A rejection means we couldn't match the reference to a credit in our account. The notification tells you why, and you can submit a corrected reference from the same order page — there's no need to re-order.",
        ],
      },
    ],
  },
  delivery: {
    title: "Delivery",
    intro: "Delivery is calculated on your order subtotal and shown before you confirm — never added as a surprise afterwards.",
    sections: [
      {
        heading: "Charges",
        body: [
          "Orders under the free-delivery threshold carry a flat delivery fee, shown in your cart and at checkout.",
          "Orders at or above the threshold are delivered free.",
        ],
      },
      {
        heading: "Timelines",
        body: [
          "Lagos and Abuja: typically 1–3 working days after payment is verified.",
          "Other states: typically 3–7 working days after payment is verified.",
          "You can follow every step — Processing, Shipped, Out for Delivery, Delivered — from your order page.",
        ],
      },
      {
        heading: "Tracking",
        body: [
          "Your order page shows a progress rail with the current stage highlighted, plus an in-app notification each time the status changes.",
        ],
      },
    ],
  },
  returns: {
    title: "Returns & refunds",
    intro: "If something arrives damaged, wrong or not as described, tell us and we'll make it right.",
    sections: [
      {
        heading: "What's eligible",
        body: [
          "Items reported within 7 days of delivery that are unused and in their original packaging.",
          "Groceries, beauty products and personal-care items can only be returned if they arrive damaged or incorrect, for hygiene reasons.",
        ],
      },
      {
        heading: "How to start a return",
        body: [
          "Open the order from your order history and contact us with your order number and a description of the problem.",
          "We'll confirm whether to send the item back or arrange a pickup, and process the refund to your bank account once the return is received.",
        ],
      },
      {
        heading: "Refund timing",
        body: [
          "Refunds are made by bank transfer to an account you nominate, normally within 5 working days of the return being approved.",
        ],
      },
    ],
  },
  contact: {
    title: "Contact us",
    intro: "We're a small team and we read everything. The fastest way to reach us about an order is from the order page itself.",
    sections: [
      {
        heading: "About an order",
        body: [
          "Open Orders, pick the order, and use the details there — your order number is the one thing we need to help quickly.",
        ],
      },
      {
        heading: "Everything else",
        body: [
          "Email hello@markethub.example and we'll reply within one working day.",
          "Our support hours are Monday to Saturday, 9am–6pm West Africa Time.",
        ],
      },
    ],
  },
};

export default function Help({ page }: { page: string }) {
  const content = CONTENT[page] ?? CONTENT.contact;
  const settings = trpc.payments.settings.useQuery();

  return (
    <StoreLayout>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Help centre</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{content.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{content.intro}</p>

        <div className="mt-8 space-y-7">
          {content.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-base font-bold">{s.heading}</h2>
              <div className="mt-2 space-y-2">
                {s.body.map((p) => (
                  <p key={p} className="text-sm leading-relaxed text-slate-600">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {page === "payments" && settings.data && (
          <div className="mt-8 rounded-xl border bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Our account</p>
            <p className="mt-1 text-sm font-bold">{settings.data.bankName}</p>
            <p className="text-xs text-muted-foreground">{settings.data.accountName}</p>
            <p className="mt-1 font-mono text-lg font-extrabold tracking-wider">{settings.data.accountNumber}</p>
            <p className="mt-2 border-t pt-2 text-xs leading-relaxed text-muted-foreground">
              {settings.data.instructions}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-2 border-t pt-6">
          <Link
            to="/orders"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            View my orders
          </Link>
          <Link
            to="/"
            className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </StoreLayout>
  );
}
