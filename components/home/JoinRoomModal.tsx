import React from "react";
import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";

import createStyles from "../../styles/indexStyles";
import { useColors } from "../../styles/theme";
import type { UseRoomExitResult } from "../../hooks/useRoomExit";
import type { MyActiveRoom } from "../../types/room";

interface JoinRoomModalProps {
  visible: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useColors>;
  conflictRoom: MyActiveRoom | null;
  exit: UseRoomExitResult;
  registeredJoinCode: string;
  setRegisteredJoinCode: (value: string) => void;
  joinRoomError: string | null;
  isJoiningRoom: boolean;
  onRequestClose: () => void;
  onCancelJoinForm: () => void;
  onSubmitJoin: () => void;
  onStay: () => void;
  onLeaveCurrentAndSwitch: () => void;
  onChooseSuccessor: (participantId: string) => void;
  onConfirmClose: () => void;
}

const getVisibleViews = (
  conflictRoom: MyActiveRoom | null,
  exit: UseRoomExitResult,
) => ({
  joinForm:
    conflictRoom === null &&
    !exit.pendingSuccessorChoice &&
    !exit.needsCloseConfirm,
  conflictPrompt:
    conflictRoom !== null &&
    !exit.pendingSuccessorChoice &&
    !exit.needsCloseConfirm,
  successorChoice: exit.pendingSuccessorChoice,
  closeConfirmation: exit.needsCloseConfirm,
});

interface JoinCodeViewProps {
  visible: boolean;
  styles: JoinRoomModalProps["styles"];
  colors: JoinRoomModalProps["colors"];
  registeredJoinCode: string;
  setRegisteredJoinCode: (value: string) => void;
  joinRoomError: string | null;
  isJoiningRoom: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

const JoinCodeView = ({
  visible,
  styles,
  colors,
  registeredJoinCode,
  setRegisteredJoinCode,
  joinRoomError,
  isJoiningRoom,
  onCancel,
  onSubmit,
}: JoinCodeViewProps) => {
  if (!visible) return null;

  return (
    <>
      <Text style={styles.modalTitle}>Join Room</Text>
      <Text style={styles.modalText}>
        Enter the room code to join as a member.
      </Text>
      <TextInput
        testID="home-join-registered-code"
        value={registeredJoinCode}
        onChangeText={setRegisteredJoinCode}
        placeholder="Room code"
        placeholderTextColor={colors.textPlaceholder}
        autoCapitalize="characters"
        style={{
          width: "100%",
          borderWidth: 1,
          borderColor: colors.borderLight,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          color: colors.textPrimary,
        }}
      />
      {joinRoomError !== null && (
        <Text testID="home-join-registered-error" style={styles.createRoomError}>
          {joinRoomError}
        </Text>
      )}
      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.modalButton, styles.buttonCancel]}
          onPress={onCancel}
        >
          <Text style={styles.textStyle}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="home-join-registered-submit"
          style={[styles.modalButton, styles.buttonConfirm]}
          disabled={isJoiningRoom}
          onPress={onSubmit}
        >
          <Text style={styles.textStyle}>
            {isJoiningRoom ? "Joining…" : "Join"}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

interface ConflictPromptProps {
  visible: boolean;
  conflictRoom: MyActiveRoom | null;
  exit: UseRoomExitResult;
  styles: JoinRoomModalProps["styles"];
  onStay: () => void;
  onLeaveAndSwitch: () => void;
}

const ConflictPrompt = ({
  visible,
  conflictRoom,
  exit,
  styles,
  onStay,
  onLeaveAndSwitch,
}: ConflictPromptProps) => {
  if (!visible || !conflictRoom) return null;

  return (
    <>
      <Text style={styles.modalTitle}>You&apos;re in another room</Text>
      <Text style={styles.modalText}>
        {conflictRoom.role === "owner"
          ? "You're hosting a room. Leave it (handover or close) and join this one?"
          : "Leave your current room and join this one?"}
      </Text>
      {exit.error !== null && (
        <Text style={styles.createRoomError}>{exit.error}</Text>
      )}
      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.modalButton, styles.buttonCancel]}
          onPress={onStay}
        >
          <Text style={styles.textStyle}>Stay</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="home-conflict-leave-and-switch"
          style={[styles.modalButton, styles.buttonConfirm]}
          disabled={exit.isExiting}
          onPress={onLeaveAndSwitch}
        >
          <Text style={styles.textStyle}>
            {exit.isExiting ? "Leaving…" : "Leave & Join"}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

interface SuccessorChoiceProps {
  visible: boolean;
  exit: UseRoomExitResult;
  styles: JoinRoomModalProps["styles"];
  onChooseSuccessor: (participantId: string) => void;
}

const SuccessorChoice = ({
  visible,
  exit,
  styles,
  onChooseSuccessor,
}: SuccessorChoiceProps) => {
  if (!visible) return null;

  return (
    <>
      <Text style={styles.modalTitle}>Choose a new host</Text>
      <Text style={styles.modalText}>
        Pick which signed-in player should take over your current room.
      </Text>
      {exit.eligibleSuccessors.map((candidate) => (
        <TouchableOpacity
          key={candidate.id}
          testID={`home-conflict-successor-${candidate.id}`}
          style={[styles.modalButton, styles.buttonConfirm, { marginTop: 8 }]}
          onPress={() => onChooseSuccessor(candidate.id)}
        >
          <Text style={styles.textStyle}>{candidate.displayName}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={[styles.modalButton, styles.buttonCancel, { marginTop: 12 }]}
        onPress={exit.cancel}
      >
        <Text style={styles.textStyle}>Cancel</Text>
      </TouchableOpacity>
    </>
  );
};

interface CloseRoomConfirmationProps {
  visible: boolean;
  exit: UseRoomExitResult;
  styles: JoinRoomModalProps["styles"];
  onConfirmClose: () => void;
}

const CloseRoomConfirmation = ({
  visible,
  exit,
  styles,
  onConfirmClose,
}: CloseRoomConfirmationProps) => {
  if (!visible) return null;

  return (
    <>
      <Text style={styles.modalTitle}>Everyone left</Text>
      <Text style={styles.modalText}>
        There&apos;s no one left to take over. Close the room and join the new one?
      </Text>
      <View style={styles.modalButtons}>
        <TouchableOpacity
          style={[styles.modalButton, styles.buttonCancel]}
          onPress={exit.cancel}
        >
          <Text style={styles.textStyle}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="home-conflict-close-and-join"
          style={[styles.modalButton, styles.buttonConfirm]}
          disabled={exit.isExiting}
          onPress={onConfirmClose}
        >
          <Text style={styles.textStyle}>
            {exit.isExiting ? "Closing…" : "Close & Join"}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

/**
 * The home screen's "Join Room" modal. Independent view checks preserve the
 * existing exit-flow precedence, including its transient overlap states.
 */
export const JoinRoomModal: React.FC<JoinRoomModalProps> = (props) => {
  const views = getVisibleViews(props.conflictRoom, props.exit);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={props.visible}
      onRequestClose={props.onRequestClose}
    >
      <View style={props.styles.centeredView}>
        <View style={props.styles.modalView}>
          <JoinCodeView
            visible={views.joinForm}
            styles={props.styles}
            colors={props.colors}
            registeredJoinCode={props.registeredJoinCode}
            setRegisteredJoinCode={props.setRegisteredJoinCode}
            joinRoomError={props.joinRoomError}
            isJoiningRoom={props.isJoiningRoom}
            onCancel={props.onCancelJoinForm}
            onSubmit={props.onSubmitJoin}
          />
          <ConflictPrompt
            visible={views.conflictPrompt}
            conflictRoom={props.conflictRoom}
            exit={props.exit}
            styles={props.styles}
            onStay={props.onStay}
            onLeaveAndSwitch={props.onLeaveCurrentAndSwitch}
          />
          <SuccessorChoice
            visible={views.successorChoice}
            exit={props.exit}
            styles={props.styles}
            onChooseSuccessor={props.onChooseSuccessor}
          />
          <CloseRoomConfirmation
            visible={views.closeConfirmation}
            exit={props.exit}
            styles={props.styles}
            onConfirmClose={props.onConfirmClose}
          />
        </View>
      </View>
    </Modal>
  );
};
