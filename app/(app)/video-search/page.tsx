import { redirect } from "next/navigation";

/** 영상 찾기는 BIBL로 옮겼다. 예전 주소로 들어와도 길을 잃지 않게 보낸다. */
export default function VideoSearchMoved() {
  redirect("/bibl");
}
