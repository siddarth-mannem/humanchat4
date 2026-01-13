export default function Loading() {
  return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>Loading schedule...</p>
      </div>
    </div>
  );
}
