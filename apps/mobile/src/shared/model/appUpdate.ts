import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// checking: 스플래시에서 버전 확인 중 / ok: 진입 허용 / required: 최신 빌드로 업데이트해야 진입 가능
type AppUpdateStatus = 'checking' | 'ok' | 'required';

type AppUpdateState = {
  status: AppUpdateStatus;
  updateUrl: string | null;
};

type AppUpdateActions = {
  setChecked: (updateUrl: string | null) => void;
  /** updateUrl을 생략하면 스플래시에서 받아 둔 링크를 그대로 쓴다 (사용 중 426 응답을 받은 경우) */
  requireUpdate: (updateUrl?: string | null) => void;
};

export const useAppUpdateStore = create<AppUpdateState & AppUpdateActions>()(
  immer(set => ({
    status: 'checking',
    updateUrl: null,
    setChecked: updateUrl =>
      set(s => {
        // 확인 중에 426을 먼저 받아 required가 된 경우 되돌리지 않는다
        if (s.status === 'checking') s.status = 'ok';
        s.updateUrl = updateUrl;
      }),
    requireUpdate: updateUrl =>
      set(s => {
        s.status = 'required';
        if (updateUrl !== undefined) s.updateUrl = updateUrl;
      }),
  })),
);
