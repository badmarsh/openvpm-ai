import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book an appointment",
  description: "Book an appointment online",
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}
