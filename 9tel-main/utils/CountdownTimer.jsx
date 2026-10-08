import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

const CountdownTimer = ({ startDate }) => {
    // const startDate = new Date('2025-05-13T10:15:28.853Z');
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // One month later

    const [timeLeft, setTimeLeft] = useState(getTimeRemaining());
    const [isTimeUp, setIsTimeUp] = useState(false);

    function getTimeRemaining() {
        const now = new Date();
        const total = endDate - now;

        if (total <= 0) {
            return {
                total: 0,
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0,
            };
        }

        const seconds = Math.floor((total / 1000) % 60);
        const minutes = Math.floor((total / 1000 / 60) % 60);
        const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
        const days = Math.floor(total / (1000 * 60 * 60 * 24));

        return {
            total,
            days,
            hours,
            minutes,
            seconds,
        };
    }

    useEffect(() => {
        const timer = setInterval(() => {
            const remaining = getTimeRemaining();
            setTimeLeft(remaining);

            if (remaining.total <= 0) {
                setIsTimeUp(true);
                clearInterval(timer);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <View style={styles.container}>
            {!isTimeUp ? (
                <>
                    {/* <Text style={styles.text}>Countdown to 1 Month From 2025-05-13:</Text> */}
                    <Text style={styles.timer} className='text-white'>
                        {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
                    </Text>
                </>
            ) : (
                <Text style={styles.done}>🎉 Time's up!</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        // padding: 20,
        // flex: 1,
    },
    text: {
        fontSize: 18,
        marginBottom: 10,
        color: '#FEDA42'
    },
    timer: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#FEDA42'
    },
    done: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'green',
    },
});

export default CountdownTimer;
