import { Dialog, AppInput, Button } from '@/shared/ui'
import { useJoinRoom } from '@/features/room/api'
import { useModalForm, handleApiError } from '@/shared/lib'
import { spacing } from '@/shared/config'
import { View } from 'dripsy'

type Props = {
  visible: boolean
  onClose: () => void
  roomCode: string
}

export function FriendPasswordModal({ visible, onClose, roomCode }: Props) {
  const { value: password, setValue: setPassword, error: errorMsg, setError: setErrorMsg, handleClose } = useModalForm('', onClose)
  const { mutate, isPending } = useJoinRoom()

  const handleJoin = (): void => {
    setErrorMsg(undefined)
    mutate({ code: roomCode, password }, {
      onError: (e) => handleApiError(e, {
        setError: setErrorMsg,
        overrides: { WRONG_PASSWORD: { type: 'setError', message: '비밀번호가 달라요! 다시 확인해 주세요' } },
        fallbackMessage: '방에 들어가지 못했어요. 다시 시도해 주세요!',
      }),
      onSuccess: () => { handleClose() },
    })
  }

  return (
    <Dialog visible={visible} onClose={handleClose} title="비밀번호 입력">
      <View sx={{ gap: spacing.MD }}>
        <AppInput
          value={password}
          onChangeText={(t) => { setPassword(t); setErrorMsg(undefined) }}
          placeholder="방 비밀번호"
          secureTextEntry
          error={errorMsg}
        />
        <Button
          label="입장"
          color="primary"
          disabled={password.length === 0}
          loading={isPending}
          onPress={handleJoin}
        />
      </View>
    </Dialog>
  )
}
