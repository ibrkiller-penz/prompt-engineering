import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-extrabold">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 text-muted">주소를 다시 확인해 주세요.</p>
      <Link to="/" className="mt-6 inline-block font-semibold text-accent underline">
        처음으로
      </Link>
    </main>
  );
}
