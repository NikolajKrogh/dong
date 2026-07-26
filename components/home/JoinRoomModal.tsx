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

/**
 * The home screen's "Join Room" modal: the join-code form, the
 * already-in-another-room conflict prompt, the host-successor chooser, and
 * the "everyone left, close and join" confirmation — one of the four is
 * shown at a time based on `conflictRoom`/`exit` state.
 */
export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  visible,
  styles,
  colors,
  conflictRoom,
  exit,
  registeredJoinCode,
  setRegisteredJoinCode,
  joinRoomError,
  isJoiningRoom,
  onRequestClose,
  onCancelJoinForm,
  onSubmitJoin,
  onStay,
  onLeaveCurrentAndSwitch,
  onChooseSuccessor,
  onConfirmClose,
}) => {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onRequestClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          {conflictRoom === null &&
          !exit.pendingSuccessorChoice &&
          !exit.needsCloseConfirm ? (
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
                <Text
                  testID="home-join-registered-error"
                  style={styles.createRoomError}
                >
                  {joinRoomError}
                </Text>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.buttonCancel]}
                  onPress={onCancelJoinForm}
                >
                  <Text style={styles.textStyle}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="home-join-registered-submit"
                  style={[styles.modalButton, styles.buttonConfirm]}
                  disabled={isJoiningRoom}
                  onPress={onSubmitJoin}
                >
                  <Text style={styles.textStyle}>
                    {isJoiningRoom ? "Joining…" : "Join"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {conflictRoom !== null &&
          !exit.pendingSuccessorChoice &&
          !exit.needsCloseConfirm ? (
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
                  onPress={onLeaveCurrentAndSwitch}
                >
                  <Text style={styles.textStyle}>
                    {exit.isExiting ? "Leaving…" : "Leave & Join"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {exit.pendingSuccessorChoice ? (
            <>
              <Text style={styles.modalTitle}>Choose a new host</Text>
              <Text style={styles.modalText}>
                Pick which signed-in player should take over your current
                room.
              </Text>
              {exit.eligibleSuccessors.map((candidate) => (
                <TouchableOpacity
                  key={candidate.id}
                  testID={`home-conflict-successor-${candidate.id}`}
                  style={[
                    styles.modalButton,
                    styles.buttonConfirm,
                    { marginTop: 8 },
                  ]}
                  onPress={() => onChooseSuccessor(candidate.id)}
                >
                  <Text style={styles.textStyle}>{candidate.displayName}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.buttonCancel,
                  { marginTop: 12 },
                ]}
                onPress={exit.cancel}
              >
                <Text style={styles.textStyle}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {exit.needsCloseConfirm ? (
            <>
              <Text style={styles.modalTitle}>Everyone left</Text>
              <Text style={styles.modalText}>
                There&apos;s no one left to take over. Close the room and join
                the new one?
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.buttonCancel]}
                  onPress={exit.cancel}
                >
                  <Text style={styles.textStyle}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="home-conflict-close-confirm"
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
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

export default JoinRoomModal;
