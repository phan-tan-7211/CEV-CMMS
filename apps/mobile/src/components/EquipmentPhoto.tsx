import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export function EquipmentPhoto({
  uri,
  width,
  height,
  borderRadius = 12,
  accessibilityLabel,
}: {
  uri: string
  width: number
  height: number
  borderRadius?: number
  accessibilityLabel: string
}) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setFailed(false)
    setLoaded(false)
  }, [uri])

  const hasImage = Boolean(uri) && !failed

  return (
    <View style={[styles.frame, { width, height, borderRadius }]}>
      {!hasImage ? (
        <View style={styles.placeholder}>
          <Ionicons name="cube-outline" size={Math.min(24, width * 0.38)} color="#7F9CF5" />
        </View>
      ) : (
        <>
          {!loaded ? <ActivityIndicator style={styles.loader} size="small" color="#98A2B3" /> : null}
          <Image
            source={{ uri }}
            accessibilityLabel={accessibilityLabel}
            resizeMode="contain"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            style={styles.image}
          />
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E7EC',
    backgroundColor: '#F8FAFC',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF4FF',
  },
  loader: {
    position: 'absolute',
    zIndex: 1,
  },
})
