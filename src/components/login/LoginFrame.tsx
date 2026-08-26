import { APP_NAME, APP_SUBTITLE } from "@/lib/school";

export function LoginFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center overflow-x-hidden bg-[#f3f4f6] px-4 py-6 sm:py-8">
      <div className="w-full max-w-[440px] rounded-[20px] border border-[#e8e8ea] bg-white px-6 pt-5 pb-8 shadow-[0_16px_48px_rgba(15,23,42,0.08)] sm:px-8 sm:pt-6 sm:pb-10">
        <div className="flex flex-col items-center text-center">
          <img
            src="/front_image.png"
            alt=""
            className="h-auto w-full max-h-48 object-contain mix-blend-multiply"
          />
          <h1 className="mt-1.5 text-[28px] leading-none font-semibold tracking-tight text-navy">
            {APP_NAME}
          </h1>
          <p className="mt-2 text-[13px] font-medium text-[#4b5563]">{APP_SUBTITLE}</p>
        </div>
        <div className="mt-6 border-t border-[#ececee] pt-6">{children}</div>
        <p className="mt-8 text-center text-xs text-[#9aa1aa]">
          Authorized staff only
        </p>
      </div>
    </div>
  );
}
