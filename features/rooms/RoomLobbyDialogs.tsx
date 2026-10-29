import {
  useCallback
} from "react";
import { Modal } from "react-native";
import { Text, YStack } from "tamagui";
import { ShellActionButton } from "../../components/ui";
import { ASSIGNMENT_MODE_LABELS } from "../../types/room";
import { LobbyAssignmentController, RoomLobbyExit } from "./RoomLobbyWizard";
import { SuccessorChooserModal } from "./SuccessorChooserModal";
import { RoomLobbyConfigure } from "./useLobbyAssignmentController";

export function RoomLobbyDialogs({
  assignment,
  configure,
  exit,
  isEndGameConfirmVisible,
  onCloseEndGameConfirmation,
  onEndGame,
  onChooseSuccessor,
  onConfirmClose,
}: {
  assignment: LobbyAssignmentController;
  configure: RoomLobbyConfigure;
  exit: RoomLobbyExit;
  isEndGameConfirmVisible: boolean;
  onCloseEndGameConfirmation: () => void;
  onEndGame: () => Promise<void>;
  onChooseSuccessor: (id: string) => Promise<void>;
  onConfirmClose: () => Promise<void>;
}) {
  return (
    <>
      <AssignmentModeSwitchDialog
        assignment={assignment}
        onConfirm={assignment.handleConfirmModeSwitch}
        onCancel={assignment.handleCancelModeSwitch}
      />
      <EndGameDialogController
        visible={isEndGameConfirmVisible}
        isBusy={configure.isBusy}
        onClose={onCloseEndGameConfirmation}
        onConfirm={onEndGame}
      />
      <RoomExitDialogController
        exit={exit}
        onChooseSuccessor={onChooseSuccessor}
        onConfirmClose={onConfirmClose}
      />
    </>
  );
}

function EndGameDialogController({
  visible,
  isBusy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const handleConfirm = useCallback(() => {
    void onConfirm();
  }, [onConfirm]);

  return (
    <EndGameConfirmationDialog
      visible={visible}
      isBusy={isBusy}
      onClose={onClose}
      onConfirm={handleConfirm}
    />
  );
}

function RoomExitDialogController({
  exit,
  onChooseSuccessor,
  onConfirmClose,
}: {
  exit: RoomLobbyExit;
  onChooseSuccessor: (id: string) => Promise<void>;
  onConfirmClose: () => Promise<void>;
}) {
  const handleChooseSuccessor = useCallback((id: string) => {
    void onChooseSuccessor(id);
  }, [onChooseSuccessor]);
  const handleConfirmClose = useCallback(() => {
    void onConfirmClose();
  }, [onConfirmClose]);

  return (
    <>
      <SuccessorChooserModal
        visible={exit.pendingSuccessorChoice}
        candidates={exit.eligibleSuccessors}
        onChoose={handleChooseSuccessor}
        onCancel={exit.cancel}
      />
      <CloseRoomConfirmationDialog
        visible={exit.needsCloseConfirm}
        onCancel={exit.cancel}
        onConfirm={handleConfirmClose}
      />
    </>
  );
}

function AssignmentModeSwitchDialog({
  assignment,
  onConfirm,
  onCancel,
}: {
  assignment: LobbyAssignmentController;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const pendingMode = assignment.pendingModeSwitch;
  return (
    <Modal
      visible={pendingMode !== null}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$backgroundModalOverlay"
        padding="$5"
      >
        <YStack
          testID="lobby-assignment-mode-confirm"
          backgroundColor="$background"
          borderRadius="$6"
          gap="$3"
          padding="$5"
          width="100%"
          maxWidth={420}
        >
          <Text color="$color" fontSize={20} fontWeight="700">
            Switch assignment mode?
          </Text>
          <Text color="$colorMuted" fontSize={14}>
            The current draft arrangement will not carry over to{" "}
            {pendingMode ? ASSIGNMENT_MODE_LABELS[pendingMode] : ""}{" "}
            mode.
          </Text>
          {assignment.modeSwitchRaisesMinimum ? (
            <Text
              testID="lobby-assignment-mode-confirm-minimum-notice"
              color="$danger"
              fontSize={13}
            >
              Switching to automatic raises the per-player count to{" "}
              {assignment.automaticMinimum} to satisfy the shared-matches setting.
            </Text>
          ) : null}
          <ShellActionButton
            variant="danger"
            label="Switch mode"
            testID="lobby-assignment-mode-confirm-button"
            onPress={onConfirm}
          />
          <ShellActionButton variant="surface" label="Cancel" onPress={onCancel} />
        </YStack>
      </YStack>
    </Modal>
  );
}

function EndGameConfirmationDialog({
  visible,
  isBusy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  isBusy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$backgroundModalOverlay"
        padding="$5"
      >
        <YStack
          testID="lobby-end-game-confirm"
          backgroundColor="$background"
          borderRadius="$6"
          gap="$3"
          padding="$5"
          width="100%"
          maxWidth={420}
        >
          <Text color="$color" fontSize={20} fontWeight="700">End the game?</Text>
          <Text color="$colorMuted" fontSize={14}>
            This finishes the game for everyone in the room. It cannot be resumed.
          </Text>
          <ShellActionButton
            variant="danger"
            label="End game"
            testID="lobby-end-game-confirm-button"
            disabled={isBusy}
            onPress={onConfirm}
          />
          <ShellActionButton variant="surface" label="Cancel" onPress={onClose} />
        </YStack>
      </YStack>
    </Modal>
  );
}

function CloseRoomConfirmationDialog({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        backgroundColor="$backgroundModalOverlay"
        padding="$5"
      >
        <YStack
          testID="lobby-close-confirm"
          backgroundColor="$background"
          borderRadius="$6"
          gap="$3"
          padding="$5"
          width="100%"
          maxWidth={420}
        >
          <Text color="$color" fontSize={20} fontWeight="700">Everyone left</Text>
          <Text color="$colorMuted" fontSize={14}>
            There&apos;s no one left to take over. Close the room?
          </Text>
          <ShellActionButton
            variant="danger"
            label="Close room"
            testID="lobby-close-confirm-button"
            onPress={onConfirm}
          />
          <ShellActionButton variant="surface" label="Cancel" onPress={onCancel} />
        </YStack>
      </YStack>
    </Modal>
  );
}
