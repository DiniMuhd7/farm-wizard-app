
import { useState } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

const WebViewModal = ({ visible, url, onClose }) => {
    const [loading, setLoading] = useState(true);

    return (
        <Modal
            animationType="slide"
            visible={visible}
            onRequestClose={onClose}
            transparent={false}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={styles.closeText}>Close</Text>
                    </TouchableOpacity>
                </View>
                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#007AFF" />
                    </View>
                )}
                <WebView source={{ uri: url }} onLoadStart={() => setLoading(true)}
                    onLoadEnd={() => setLoading(false)} style={styles.webview} />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingTop: 50,
        paddingBottom: 10,
        backgroundColor: '#f8f8f8',
        alignItems: 'flex-end',
        paddingRight: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    closeText: {
        color: '#007AFF',
        fontSize: 18,
    },
    webview: {
        flex: 1,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 100,
        left: 0,
        right: 0,
        zIndex: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default WebViewModal;

