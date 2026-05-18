import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { PixelModal } from '@/shared/ui/PixelModal'
import { PixelInput } from '@/shared/ui/PixelInput'
import { PixelButton } from '@/shared/ui/PixelButton'
import { useJoinRoom } from '@/features/room/api/useJoinRoom'
import { ApiError } from '@/shared/api/client'
import { spacing } from '@/shared/config/theme'

type Props = {
  visible: boolean
  onClose: () => void
}

const ERROR_MESSAGE: Record<string, string> = {
  ROOM_NOT_FOUND: '방을 찾을 수 없습니다. 코드를 다시 확인하세요.',
  ROOM_FULL: '방이 가득 찼습니다.',
  ROOM_LOCKED: '잠긴 방입니다.',
}

export function CodeJoinModal({ visible, onClose }: Props): React.JSX.Element {
  const [code, setCode] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined)
  const { mutate, isPending } = useJoinRoom()

  const handleClose = (): void => {
    setCode('')
    setErrorMsg(undefined)
    onClose()
  }

  const handleJoin = (): void => {
    setErrorMsg(undefined)
    mutate(code, {
      onError: (e) => {
        if (e instanceof ApiError) {
          setErrorMsg(ERROR_MESSAGE[e.code] ?? '입장에 실패했습니다.')
        } else {
          setErrorMsg('입장에 실패했습니다.')
        }
      },
      onSuccess: () => {
        handleClose()
      },
    })
  }

  return (
    <PixelModal visible={visible} onClose={handleClose} title="방 코드 입력">
      <View style={styles.content}>
        <PixelInput
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
        <PixelButton
          label="입장"
          variant="primary"
          disabled={code.length < 6 || isPending}
          onPress={handleJoin}
        />
      </View>
    </PixelModal>
  )
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
})
