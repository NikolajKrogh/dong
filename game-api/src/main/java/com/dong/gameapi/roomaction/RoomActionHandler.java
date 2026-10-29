package com.dong.gameapi.roomaction;

/**
 * Handles one room action type, such as {@code start-game}.
 * Implementations register as Spring beans; {@link RoomActionDispatcher} selects
 * a handler using {@link #actionType()} after validating the replay key.
 */
public interface RoomActionHandler {

    /** The action type this handler serves (the path {@code {actionType}}). */
    String actionType();

    /** Executes the action with the authenticated host and validated replay key. */
    RoomActionResult handleAction(RoomActionContext context);
}
