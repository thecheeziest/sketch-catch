import { useState } from 'react';
import { Text, View } from 'dripsy';
import { REPORT_DETAIL_MAX_LENGTH, type ReportReason } from '@sketch-catch/shared';
import { colors, spacing, textSizes } from '@/shared/config';
import { handleApiError } from '@/shared/lib';
import { useToastStore } from '@/shared/model';
import { AppInput, Button, Dialog, type DialogButton } from '@/shared/ui';
import { useReportUser } from '../../api';
import { REPORT_REASONS } from '../../config/sprites';
import { useReportStore } from '../../model';

// 앱 루트에 하나만 둔다 — 채팅 길게 누르기·프로필 어디서 신고해도 같은 사유 선택 창이 뜬다
export function ReportDialog() {
  const target = useReportStore(s => s.target);
  const closeStore = useReportStore(s => s.close);
  const { mutate, isPending } = useReportUser();
  const [pendingReason, setPendingReason] = useState<ReportReason | null>(null);
  // '기타'를 고르면 같은 창에서 직접 쓴 사유를 받는다
  const [isWritingDetail, setIsWritingDetail] = useState(false);
  const [detail, setDetail] = useState('');
  const trimmedDetail = detail.trim();

  const close = (): void => {
    setIsWritingDetail(false);
    setDetail('');
    closeStore();
  };

  const submit = (reason: ReportReason): void => {
    if (!target || isPending) return;
    setPendingReason(reason);
    mutate(
      {
        targetId: target.userId,
        reason,
        messageId: target.messageId,
        detail: reason === 'OTHER' ? trimmedDetail : undefined,
      },
      {
        onSuccess: () => {
          useToastStore.getState().show('신고가 접수됐어요. 확인 후 조치할게요', 'success');
          close();
        },
        onError: err => handleApiError(err, { fallbackType: 'toast' }),
        onSettled: () => setPendingReason(null),
      },
    );
  };

  const handleReason = (reason: ReportReason): void => {
    if (reason === 'OTHER') {
      setIsWritingDetail(true);
      return;
    }
    submit(reason);
  };

  const description = target?.messageId
    ? `${target.nickname}님의 채팅을 신고하는 이유를 골라 주세요`
    : `${target?.nickname ?? ''}님을 신고하는 이유를 골라 주세요`;

  const buttons: DialogButton[] = isWritingDetail
    ? [
        { label: '뒤로', color: 'light', onPress: () => setIsWritingDetail(false), disabled: isPending },
        {
          label: '신고하기',
          color: 'primary',
          onPress: () => submit('OTHER'),
          disabled: trimmedDetail.length === 0,
          loading: isPending,
        },
      ]
    : [{ label: '취소', color: 'light', onPress: close, disabled: isPending }];

  return (
    <Dialog visible={target !== null} onClose={close} title="신고하기" buttons={buttons}>
      {isWritingDetail ? (
        <AppInput
          value={detail}
          onChangeText={setDetail}
          placeholder="어떤 점이 문제인지 적어 주세요"
          maxLength={REPORT_DETAIL_MAX_LENGTH}
          showCounter
          autoFocus
        />
      ) : (
        <View sx={{ gap: spacing.SM }}>
          <Text sx={{ ...textSizes.B3, color: colors.LIGHT_100, textAlign: 'center' }}>{description}</Text>
          {REPORT_REASONS.map(reason => (
            <Button
              key={reason.value}
              label={reason.label}
              color="dark"
              height={40}
              loading={pendingReason === reason.value}
              disabled={isPending && pendingReason !== reason.value}
              onPress={() => handleReason(reason.value)}
            />
          ))}
        </View>
      )}
    </Dialog>
  );
}
