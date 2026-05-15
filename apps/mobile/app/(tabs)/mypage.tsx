import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import styled from 'styled-components/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMe } from '@/features/auth/useMe';
import { useLogout } from '@/features/auth/useLogout';
import { ProfileCard } from '@/features/profile/ProfileCard';
import { ProfileRow } from '@/features/profile/ProfileRow';
import { useNicknameCooldown, formatKoreanDate } from '@/features/profile/useNicknameCooldown';

// 모달은 Task 2에서 마운트 — 미리 import 선언
import { NicknameModal } from '@/features/profile/NicknameModal';
import { FriendCodeModal } from '@/features/profile/FriendCodeModal';
import { CharacterModal } from '@/features/profile/CharacterModal';
import { DeleteAccountModal } from '@/features/profile/DeleteAccountModal';

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.background};
`;

const Divider = styled.View`
  height: 1px;
  background-color: ${({ theme }) => theme.colors.border};
`;

const CooldownText = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.body.fontSize}px;
  line-height: ${({ theme }) => theme.typography.body.lineHeight}px;
  color: ${({ theme }) => theme.colors.textSecondary};
  padding-horizontal: ${({ theme }) => theme.spacing.md}px;
  padding-bottom: ${({ theme }) => theme.spacing.xs}px;
`;

const ButtonArea = styled.View`
  margin-top: ${({ theme }) => theme.spacing.xl}px;
  padding-horizontal: ${({ theme }) => theme.spacing.xl}px;
  gap: ${({ theme }) => theme.spacing.sm}px;
`;

// 로그아웃 버튼 — PixelButton secondary 스타일 수동 재현 (import 순환 방지 및 직접 제어)
const LogoutButton = styled(Pressable)`
  height: 48px;
  border-width: 2px;
  border-color: ${({ theme }) => theme.colors.textPrimary};
  background-color: ${({ theme }) => theme.colors.surface};
  align-items: center;
  justify-content: center;
`;

const LogoutLabel = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.label.fontSize}px;
  line-height: ${({ theme }) => theme.typography.label.lineHeight}px;
  color: ${({ theme }) => theme.colors.textPrimary};
`;

// 회원 탈퇴 버튼 — UI-SPEC: backgroundColor destructive, borderColor textPrimary, 텍스트 background 색
const DeleteButton = styled(Pressable)`
  height: 48px;
  background-color: ${({ theme }) => theme.colors.destructive};
  border-width: 2px;
  border-color: ${({ theme }) => theme.colors.textPrimary};
  align-items: center;
  justify-content: center;
`;

const DeleteLabel = styled.Text`
  font-family: ${({ theme }) => theme.fontFamily.regular};
  font-size: ${({ theme }) => theme.typography.label.fontSize}px;
  line-height: ${({ theme }) => theme.typography.label.lineHeight}px;
  color: ${({ theme }) => theme.colors.background};
`;

export default function MyPageScreen(): React.JSX.Element | null {
  const { data: user } = useMe();
  const logout = useLogout();
  const cooldown = useNicknameCooldown(user?.nicknameChangedAt ?? null);

  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [friendCodeOpen, setFriendCodeOpen] = useState(false);
  const [characterOpen, setCharacterOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!user) return null;

  return (
    <Container>
      <ProfileCard
        nickname={user.nickname}
        friendCode={user.friendCode}
        characterId={user.characterId}
      />
      <Divider />
      <ProfileRow
        label="닉네임"
        value={user.nickname}
        onPress={() => setNicknameOpen(true)}
        disabled={!cooldown.canChange}
      />
      {!cooldown.canChange && (
        <CooldownText allowFontScaling={false}>
          다음 변경: {formatKoreanDate(cooldown.nextChangeAt)}
        </CooldownText>
      )}
      <ProfileRow
        label="친구코드"
        value={user.friendCode}
        onPress={() => setFriendCodeOpen(true)}
      />
      <ProfileRow
        label="캐릭터"
        value={user.characterId}
        onPress={() => setCharacterOpen(true)}
      />
      <Divider />
      <ButtonArea>
        <LogoutButton
          onPress={logout}
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
        >
          <LogoutLabel allowFontScaling={false}>로그아웃</LogoutLabel>
        </LogoutButton>
        <DeleteButton
          onPress={() => setDeleteOpen(true)}
          style={({ pressed }) => (pressed ? { opacity: 0.7 } : null)}
        >
          <DeleteLabel allowFontScaling={false}>회원 탈퇴</DeleteLabel>
        </DeleteButton>
      </ButtonArea>

      <NicknameModal
        visible={nicknameOpen}
        onClose={() => setNicknameOpen(false)}
        currentNickname={user.nickname}
      />
      <FriendCodeModal
        visible={friendCodeOpen}
        onClose={() => setFriendCodeOpen(false)}
        currentFriendCode={user.friendCode}
      />
      <CharacterModal
        visible={characterOpen}
        onClose={() => setCharacterOpen(false)}
        currentCharacterId={user.characterId}
      />
      <DeleteAccountModal
        visible={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </Container>
  );
}
