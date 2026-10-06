import { Dialog, AppInput, Button } from '@/shared/ui'
import { useJoinRoom } from '@/features/room/api'
import { useModalForm, handleApiError } from '@/shared/lib'
import { spacing } from '@/shared/config'
import { View } from 'dripsy'

type Props = {
  visible: boolean
  onClose: () => void
}

export function CodeJoinModal({ visible, onClose }: Props) {
  const { value: code, setValue: setCode, error: errorMsg, setError: setErrorMsg, handleClose } = useModalForm('', onClose)
  const { mutate, isPending } = useJoinRoom()

  const handleJoin = (): void => {
    setErrorMsg(undefined)
    mutate({ code }, {
      onError: (e) => handleApiError(e, { setError: setErrorMsg, fallbackMessage: '입장에 실패했습니다.' }),
      onSuccess: () => { handleClose() },
    })
  }

  return (
    <Dialog visible={visible} onClose={handleClose} title="방 코드 입력">
      <View sx={{ gap: spacing.MD }}>
        <AppInput
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase())
            setErrorMsg(undefined)
          }}
          maxLength={6}
          autoCapitalize="characters"
          placeholder="6자리 코드 입력"
          error={errorMsg}
        />
        <Button
          label="입장"
          color="primary"
          disabled={code.length < 6}
          loading={isPending}
          onPress={handleJoin}
        />
      </View>
    </Dialog>
  )
}
