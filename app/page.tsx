import Image from "next/image";
import Link from "next/link";
import BounceCards from "./components/bits/BounceCards";
import LanyardFixed from "./components/bits/LanyardFixed";
import { UploadPetPhotoForm } from "./components/pet/UploadPetPhotoForm";
import { knowledgeNotes } from "./lib/knowledge-notes";
import {
  formatDateLabel,
  formatDateTimeLabel,
  getPetPhotos,
  groupPhotosByUploadDay,
  isSupabaseConfigured,
  type PetPhoto,
} from "./lib/pet-photos";

export const revalidate = 30;

function PhotoTile({ photo, priority }: { photo: PetPhoto; priority?: boolean }) {
  return (
    <Link
      href={`/photos/${photo.id}`}
      className="xhs-photo-card group relative grid overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(232,101,90,0.18)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-emerald-50">
        <Image
          src={photo.image_url}
          alt={photo.title}
          fill
          priority={priority}
          unoptimized={photo.image_url.startsWith("data:")}
          className="object-cover transition duration-500 group-hover:scale-105"
          sizes="(min-width: 1024px) 31vw, (min-width: 768px) 45vw, 100vw"
        />
      </div>
      <div className="grid gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">{photo.title}</h3>
            <p className="mt-1 text-sm font-semibold text-rose-600">{photo.pet_name}</p>
          </div>
          <span className="xhs-pill bg-[#B5E5CF]/75 text-xs font-bold text-emerald-800">
            日常
          </span>
        </div>
        {photo.note ? <p className="line-clamp-2 text-sm leading-6 text-slate-500">{photo.note}</p> : null}
        <time className="text-xs font-medium text-slate-400" dateTime={photo.uploaded_at}>
          {formatDateTimeLabel(photo.uploaded_at)}
        </time>
      </div>
    </Link>
  );
}

function CartoonFuzai() {
  return (
    <div className="fuzai-card" aria-label="福仔卡通头像">
      <span className="xhs-sparkle xhs-sparkle-one" aria-hidden="true" />
      <span className="xhs-sparkle xhs-sparkle-two" aria-hidden="true" />
      <div className="fuzai-face" aria-hidden="true">
        <span className="fuzai-ear fuzai-ear-left" />
        <span className="fuzai-ear fuzai-ear-right" />
        <span className="fuzai-eye fuzai-eye-left" />
        <span className="fuzai-eye fuzai-eye-right" />
        <span className="fuzai-nose" />
        <span className="fuzai-mouth" />
        <span className="fuzai-whisker fuzai-whisker-left-one" />
        <span className="fuzai-whisker fuzai-whisker-left-two" />
        <span className="fuzai-whisker fuzai-whisker-right-one" />
        <span className="fuzai-whisker fuzai-whisker-right-two" />
      </div>
      <div>
        <p className="xhs-pill w-fit bg-[#F8D5C4] text-xs font-black text-rose-700">今日主角</p>
        <p className="mt-1 text-2xl font-black text-slate-950">福仔</p>
      </div>
    </div>
  );
}

const diaryTags = ["福仔专属", "每日一拍", "按日期归档"];

export default async function Home() {
  const photos = await getPetPhotos();
  const groupedPhotos = groupPhotosByUploadDay(photos);
  const totalDays = groupedPhotos.length;
  const latestPhoto = photos[0];
  const bounceImages = photos.slice(0, 5).map((p) => p.image_url);
  const bounceTransforms = [
    "rotate(5deg) translate(-150px)",
    "rotate(0deg) translate(-70px)",
    "rotate(-5deg)",
    "rotate(5deg) translate(70px)",
    "rotate(-5deg) translate(150px)",
  ];

  return (
    <div className="xhs-shell min-h-screen text-slate-900">
      {latestPhoto ? <LanyardFixed /> : null}
      <section className="xhs-hero border-b border-[#F8D5C4] px-5 pb-12 pt-28 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <div>
            <p className="xhs-section-label">福仔日常相册</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[1.02] text-slate-950 md:text-7xl">
              把<span className="xhs-highlight">福仔</span>每天的小瞬间收好
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
              上传照片、写下当天的小故事，网站会按照上传日期自动整理成清爽的福仔日常时间线。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {diaryTags.map((tag) => (
                <span key={tag} className="xhs-pill bg-white/85 text-sm font-bold text-slate-700">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-7 grid max-w-xl grid-cols-3 gap-3">
              <div className="xhs-stat-card bg-[#A8D8EA]/55">
                <p className="text-2xl font-black text-slate-950">{photos.length}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">张照片</p>
              </div>
              <div className="xhs-stat-card bg-[#D5C6E0]/55">
                <p className="text-2xl font-black text-slate-950">{totalDays}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">个日期</p>
              </div>
              <div className="xhs-stat-card bg-[#B5E5CF]/55">
                <p className="text-2xl font-black text-slate-950">10MB</p>
                <p className="mt-1 text-xs font-bold text-slate-500">单图上限</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <CartoonFuzai />
            {latestPhoto ? (
              <div className="xhs-feature-card grid overflow-hidden rounded-lg border bg-white md:grid-cols-[0.95fr_1fr]">
                <div className="xhs-polaroid-frame relative min-h-72 bg-emerald-50">
                  <Image
                    src={latestPhoto.image_url}
                    alt={latestPhoto.title}
                    fill
                    priority
                    unoptimized={latestPhoto.image_url.startsWith("data:")}
                    className="object-cover"
                    sizes="(min-width: 1024px) 40vw, 100vw"
                  />
                </div>
                <div className="flex flex-col justify-between gap-8 p-5">
                  <div>
                    <p className="xhs-pill w-fit bg-[#B5E5CF]/80 text-xs font-black text-emerald-800">最新记录</p>
                    <h2 className="mt-3 text-3xl font-black text-slate-950">{latestPhoto.title}</h2>
                    <p className="mt-3 text-sm font-bold text-rose-600">{latestPhoto.pet_name}</p>
                    {latestPhoto.note ? (
                      <p className="mt-4 text-sm leading-7 text-slate-600">{latestPhoto.note}</p>
                    ) : null}
                  </div>
                  <Link
                    href={`/photos/${latestPhoto.id}`}
                    className="xhs-button inline-flex h-10 w-fit items-center rounded-md px-4 text-sm font-bold text-white transition hover:-translate-y-0.5"
                  >
                    查看照片
                  </Link>
                </div>
              </div>
            ) : null}

            {!isSupabaseConfigured ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                当前展示的是示例数据。配置 Supabase 环境变量后，上传入口会写入
                <code className="mx-1 rounded bg-white px-1.5 py-0.5">pet_photos</code>
                表。
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section id="upload" className="px-5 py-10 md:px-8">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[320px_1fr] lg:items-start">
          <div>
            <div className="paw-trail mb-4" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="xhs-section-label">上传记录</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">记录今天的福仔</h2>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              表单提交后会重新刷新首页时间线，最新照片会出现在最上方。
            </p>
          </div>
          <UploadPetPhotoForm />
        </div>
      </section>

      <section id="gallery" className="border-t border-[#F8D5C4] bg-white/70 px-5 py-12 md:px-8">
        <div className="mx-auto max-w-6xl">
          {bounceImages.length > 0 ? (
            <div className="mb-10 flex flex-col items-center gap-3">
              <p className="xhs-section-label">最近的小瞬间</p>
              <BounceCards
                images={bounceImages}
                containerWidth={500}
                containerHeight={250}
                animationDelay={0.4}
                animationStagger={0.08}
                easeType="elastic.out(1, 0.5)"
                transformStyles={bounceTransforms}
                enableHover
              />
            </div>
          ) : null}

          <section id="notes" className="mb-16 border-y border-[#B7DCEB] py-10">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="xhs-section-label">最近学到的</p>
                <h2 className="mt-3 text-3xl font-black text-slate-950">知识日记</h2>
                <p className="mt-3 max-w-xl leading-7 text-slate-600">
                  福仔在旁边打盹，我把后端学习记录和 AI Agent 笔记整理成一篇篇可以回看的文章。
                </p>
              </div>
              <Link href="/notes" className="xhs-button inline-flex h-10 items-center rounded-md px-4 text-sm font-bold text-white transition hover:-translate-y-0.5">
                查看全部笔记
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {knowledgeNotes.slice(0, 4).map((note) => (
                <Link key={note.slug} href={`/notes/${note.slug}`} className="note-card group bg-white/65">
                  <div className="flex items-center justify-between gap-3">
                    <span className="xhs-pill bg-[#A8D8EA]/75 text-xs font-black text-sky-900">
                      {note.category.label}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">{note.readingTime}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-black text-slate-950 transition group-hover:text-rose-600">{note.title}</h3>
                  {note.excerpt ? (
                    <p className="mt-3 line-clamp-2 text-sm leading-7 text-slate-600">{note.excerpt}</p>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>

          <div className="mb-8 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="xhs-section-label">时间线</p>
              <h2 className="mt-3 text-3xl font-black text-slate-950">按上传时间整理</h2>
            </div>
            <p className="xhs-pill w-fit bg-[#F8D5C4]/80 text-sm font-semibold text-slate-600">最新的日常会排在前面</p>
          </div>

          <div className="grid gap-10">
            {groupedPhotos.map((group, groupIndex) => (
              <section key={group.date} className="grid gap-4">
                <div className="flex items-center gap-3">
                  <time
                    className="xhs-date-label text-sm font-black text-emerald-900"
                    dateTime={group.date}
                  >
                    {formatDateLabel(group.date)}
                  </time>
                  <div className="h-px flex-1 bg-emerald-100" />
                  <span className="text-xs font-bold text-slate-400">{group.photos.length} 张</span>
                </div>
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {group.photos.map((photo, photoIndex) => (
                    <PhotoTile
                      key={photo.id}
                      photo={photo}
                      priority={groupIndex === 0 && photoIndex < 2}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
