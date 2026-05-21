export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 text-center select-none">
        <p className="text-2xl font-bold tracking-tight text-slate-900">
          LexCR
        </p>
        <p className="mt-1 text-sm text-slate-500">Legal Workspace</p>
      </div>

      {children}
    </div>
  );
}
