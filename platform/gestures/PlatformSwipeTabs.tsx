import React, { useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, View } from "react-native";

import { supportsGestureEnhancement } from "./fallbacks";

interface PlatformSwipeTabsProps {
  activeIndex: number;
  onIndexChange: (index: number) => void;
  children: React.ReactNode;
  pageWidth?: number;
  pageStyle?: any;
  containerStyle?: any;
  refreshControl?: React.ReactElement;
}

const DEFAULT_PAGE_WIDTH = 400;
const SWIPE_THRESHOLD_RATIO = 0.2;

const renderContent = (
  childNode: React.ReactNode,
  index: number,
  refreshControl?: React.ReactElement,
) => {
  if (index === 0 && refreshControl && React.isValidElement(childNode)) {
    return React.cloneElement(
      childNode as React.ReactElement<{ refreshControl?: React.ReactElement }>,
      {
        refreshControl,
      },
    );
  }

  return childNode;
};

export const PlatformSwipeTabs: React.FC<PlatformSwipeTabsProps> = ({
  activeIndex,
  onIndexChange,
  children,
  pageWidth = DEFAULT_PAGE_WIDTH,
  pageStyle,
  containerStyle,
  refreshControl,
}) => {
  const pages = useMemo(() => React.Children.toArray(children), [children]);
  const translateX = useRef(
    new Animated.Value(-activeIndex * pageWidth),
  ).current;
  const currentIndexRef = useRef(activeIndex);
  const startXRef = useRef(-activeIndex * pageWidth);
  const canSwipe = supportsGestureEnhancement("tabSwipe");

  useEffect(() => {
    currentIndexRef.current = activeIndex;
    Animated.spring(translateX, {
      toValue: -activeIndex * pageWidth,
      useNativeDriver: true,
      friction: 10,
      tension: 80,
    }).start();
  }, [activeIndex, pageWidth, translateX]);

  const panResponder = useMemo(() => {
    if (!canSwipe || pages.length <= 1) {
      return null;
    }

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.25 &&
          Math.abs(gestureState.dx) > 12
        );
      },
      onPanResponderGrant: () => {
        startXRef.current = -currentIndexRef.current * pageWidth;
      },
      onPanResponderMove: (_, gestureState) => {
        const minTranslate = -(pages.length - 1) * pageWidth;
        const nextValue = Math.max(
          minTranslate,
          Math.min(0, startXRef.current + gestureState.dx),
        );
        translateX.setValue(nextValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        const threshold = pageWidth * SWIPE_THRESHOLD_RATIO;
        let nextIndex = currentIndexRef.current;

        if (gestureState.dx <= -threshold) {
          nextIndex = Math.min(currentIndexRef.current + 1, pages.length - 1);
        } else if (gestureState.dx >= threshold) {
          nextIndex = Math.max(currentIndexRef.current - 1, 0);
        }

        if (nextIndex === currentIndexRef.current) {
          Animated.spring(translateX, {
            toValue: -currentIndexRef.current * pageWidth,
            useNativeDriver: true,
            friction: 10,
            tension: 80,
          }).start();
          return;
        }

        currentIndexRef.current = nextIndex;
        onIndexChange(nextIndex);
      },
    });
  }, [canSwipe, onIndexChange, pageWidth, pages.length, translateX]);

  if (!canSwipe) {
    return (
      <View style={containerStyle}>
        <View style={pageStyle}>
          {renderContent(
            pages[activeIndex] ?? null,
            activeIndex,
            refreshControl,
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={containerStyle} {...(panResponder?.panHandlers ?? {})}>
      <Animated.View
        style={{
          flexDirection: "row",
          width: pageWidth * pages.length,
          transform: [{ translateX }],
          flex: 1,
        }}
      >
        {pages.map((page, index) => (
          <View
            key={
              React.isValidElement(page) && page.key != null
                ? String(page.key)
                : "tab-page"
            }
            style={[pageStyle, { width: pageWidth }]}
          >
            {renderContent(page, index, refreshControl)}
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

export default PlatformSwipeTabs;
