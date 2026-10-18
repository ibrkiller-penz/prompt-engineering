// 없는 주소
import { NotFoundBody, Screen, useDocTitle } from "../shell/Shell.tsx";

export default function NotFoundPage() {
  useDocTitle("찾는 화면이 없어요");
  return (
    <Screen title="찾는 화면이 없어요" tab={null}>
      <div className="page">
        <NotFoundBody />
      </div>
    </Screen>
  );
}
