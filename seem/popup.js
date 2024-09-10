let accessToken = '';
let isAudioPlaying = false;
let currentPlaylistId = null;

document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const loginSection = document.getElementById('login-section');
    const content = document.getElementById('content');
    const statusDiv = document.getElementById('status');
    const playlistsDiv = document.getElementById('playlists');
    const shuffleLikedSongsButton = document.getElementById('shuffle-liked-songs');
    const nowPlayingDiv = document.getElementById('now-playing');
    const playlistSelector = document.getElementById('playlist-selector');
    const playButton = document.getElementById('play-button');
    const previousButton = document.getElementById('previous-button');
    const nextButton = document.getElementById('next-button');

    function updateUI(isLoggedIn, username = '') {
        console.log('Updating UI, isLoggedIn:', isLoggedIn);
        loginSection.style.display = isLoggedIn ? 'none' : 'block';
        content.style.display = isLoggedIn ? 'block' : 'none';
        statusDiv.textContent = isLoggedIn ? `Logged in as ${username}` : 'Not logged in';
    }

    function getSpotifyProfile(token) {
        console.log('Getting Spotify profile');
        accessToken = token;
        fetch('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Profile data:', data);
            updateUI(true, data.display_name || data.id);
            getPlaylists(token);
        })
        .catch(error => {
            console.error('Error fetching profile:', error);
            statusDiv.textContent = `Error fetching profile: ${error.message}`;
            updateUI(false);
        });
    }

    function getPlaylists(token) {
        console.log('Getting playlists');
        fetch('https://api.spotify.com/v1/me/playlists', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Playlists data:', data);
            playlistSelector.innerHTML = '<option value="liked">Liked Songs</option>';
            data.items.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                option.textContent = playlist.name;
                playlistSelector.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error fetching playlists:', error);
            playlistSelector.innerHTML = `<option>Error fetching playlists: ${error.message}</option>`;
        });
    }

    async function getActiveDevice() {
        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/devices', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const activeDevice = data.devices.find(device => device.is_active);
            return activeDevice ? activeDevice.id : null;
        } catch (error) {
            console.error('Error getting active device:', error);
            statusDiv.textContent = `Error: ${error.message}. Make sure Spotify is open and active.`;
            return null;
        }
    }

    async function togglePlayPause() {
        const selectedPlaylistId = playlistSelector.value;
        
        if (!isAudioPlaying || currentPlaylistId !== selectedPlaylistId) {
            await playSelectedPlaylist();
        } else {
            await pausePlayback();
        }
    }

    async function playSelectedPlaylist() {
        const selectedValue = playlistSelector.value;
        const deviceId = await getActiveDevice();
        
        if (!deviceId) {
            statusDiv.textContent = "No active Spotify device found. Open Spotify and start playing, then try again.";
            return;
        }

        let endpoint, body;
        if (selectedValue === 'liked') {
            endpoint = `https://api.spotify.com/v1/me/tracks?limit=50`;
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const trackUris = data.items.map(item => item.track.uri);
            body = JSON.stringify({ uris: trackUris.sort(() => 0.5 - Math.random()) });
        } else {
            endpoint = `https://api.spotify.com/v1/playlists/${selectedValue}/tracks`;
            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const trackUris = data.items.map(item => item.track.uri);
            body = JSON.stringify({ uris: trackUris.sort(() => 0.5 - Math.random()).slice(0, 50) });
        }

        try {
            const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: body
            });

            if (!playResponse.ok) {
                if (playResponse.status === 404) {
                    throw new Error('No active device found. Make sure Spotify is open and playing.');
                } else {
                    const errorData = await playResponse.json();
                    throw new Error(errorData.error.message || 'Unknown error occurred');
                }
            }

            isAudioPlaying = true;
            currentPlaylistId = selectedValue;
            statusDiv.textContent = 'Playback started!';
            updatePlayButton();
            setTimeout(updateNowPlaying, 1000);
        } catch (error) {
            console.error('Error starting playback:', error);
            statusDiv.textContent = `Error: ${error.message}. Make sure you have Spotify Premium and an active device.`;
        }
    }

    async function pausePlayback() {
        const deviceId = await getActiveDevice();
        
        if (!deviceId) {
            throw new Error('No active Spotify device found. Open Spotify and start playing, then try again.');
        }

        try {
            const response = await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('No active device found. Make sure Spotify is open and playing.');
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error.message || 'Unknown error occurred');
                }
            }

            isAudioPlaying = false;
            updatePlayButton();
            setTimeout(updateNowPlaying, 1000);
        } catch (error) {
            console.error('Error pausing playback:', error);
            statusDiv.textContent = `Error: ${error.message}. Make sure you have an active Spotify device.`;
        }
    }

    async function resumePlayback() {
        const deviceId = await getActiveDevice();
        
        if (!deviceId) {
            statusDiv.textContent = "No active Spotify device found. Open Spotify and start playing, then try again.";
            return;
        }

        try {
            const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('No active device found. Make sure Spotify is open and playing.');
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.error.message || 'Unknown error occurred');
                }
            }

            isAudioPlaying = true;
            statusDiv.textContent = 'Playback resumed!';
            updatePlayButton();
            setTimeout(updateNowPlaying, 1000);
        } catch (error) {
            console.error('Error resuming playback:', error);
            statusDiv.textContent = `Error: ${error.message}. Make sure you have Spotify Premium and an active device.`;
        }
    }

    async function playPreviousTrack() {
        const deviceId = await getActiveDevice();
        
        if (!deviceId) {
            statusDiv.textContent = "No active Spotify device found. Open Spotify and start playing, then try again.";
            return;
        }

        try {
            const response = await fetch(`https://api.spotify.com/v1/me/player/previous?device_id=${deviceId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || 'Unknown error occurred');
            }

            setTimeout(updateNowPlaying, 1000);
        } catch (error) {
            console.error('Error playing previous track:', error);
            statusDiv.textContent = `Error: ${error.message}. Make sure you have an active Spotify device.`;
        }
    }

    async function playNextTrack() {
        const deviceId = await getActiveDevice();
        
        if (!deviceId) {
            statusDiv.textContent = "No active Spotify device found. Open Spotify and start playing, then try again.";
            return;
        }

        try {
            const response = await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || 'Unknown error occurred');
            }

            setTimeout(updateNowPlaying, 1000);
        } catch (error) {
            console.error('Error playing next track:', error);
            statusDiv.textContent = `Error: ${error.message}. Make sure you have an active Spotify device.`;
        }
    }

    function updatePlayButton() {
        playButton.textContent = isAudioPlaying ? 'Pause' : 'Play Selected';
    }

    playButton.addEventListener('click', async () => {
        if (isAudioPlaying) {
            await pausePlayback();
        } else {
            if (currentPlaylistId === playlistSelector.value) {
                await resumePlayback();
            } else {
                await playSelectedPlaylist();
            }
        }
    });
    previousButton.addEventListener('click', playPreviousTrack);
    nextButton.addEventListener('click', playNextTrack);

    chrome.storage.local.get(['spotifyAccessToken'], (result) => {
        console.log('Checking for stored access token');
        if (result.spotifyAccessToken) {
            console.log('Access token found, getting profile');
            getSpotifyProfile(result.spotifyAccessToken);
        } else {
            console.log('No access token found, updating UI');
            updateUI(false);
        }
    });

    loginButton.addEventListener('click', () => {
        console.log('Login button clicked');
        chrome.runtime.sendMessage({action: 'login'}, (response) => {
            console.log('Login response:', response);
            if (response && response.success) {
                chrome.storage.local.get(['spotifyAccessToken'], (result) => {
                    if (result.spotifyAccessToken) {
                        console.log('Access token received, getting profile');
                        getSpotifyProfile(result.spotifyAccessToken);
                    } else {
                        console.error('No access token received after login');
                        statusDiv.textContent = 'Login failed: No access token received';
                    }
                });
            } else {
                console.error('Login failed', response ? response.error : 'Unknown error');
                statusDiv.textContent = `Login failed: ${response ? response.error : 'Unknown error'}`;
            }
        });
    });

    logoutButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({action: 'logout'}, (response) => {
            if (response && response.success) {
                console.log('Logged out successfully');
                updateUI(false);
            } else {
                console.error('Logout failed');
                statusDiv.textContent = 'Logout failed. Please try again.';
            }
        });
    });

    async function updateNowPlaying() {
        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.status === 204) {
                nowPlayingDiv.textContent = 'No track currently playing';
                isAudioPlaying = false;
                updatePlayButton();
                return;
            }
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data && data.item) {
                nowPlayingDiv.textContent = `Now playing: ${data.item.name} by ${data.item.artists[0].name}`;
                isAudioPlaying = data.is_playing;
                updatePlayButton();
                previousButton.disabled = data.actions.disallows.skipping_prev;
                nextButton.disabled = data.actions.disallows.skipping_next;
            } else {
                nowPlayingDiv.textContent = 'No track currently playing';
                isAudioPlaying = false;
                updatePlayButton();
                previousButton.disabled = true;
                nextButton.disabled = true;
            }
        } catch (error) {
            console.error('Error fetching now playing:', error);
            nowPlayingDiv.textContent = `Error: ${error.message}`;
        }
    }

    function updateAudioStatus() {
        updateNowPlaying();
    }

    // Update audio status every 5 seconds
    setInterval(updateAudioStatus, 5000);

    // Initial update
    updateAudioStatus();
});