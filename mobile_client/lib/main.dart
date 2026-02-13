import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'api_client.dart';
import 'models.dart';

import 'package:lyricvault_core/lyricvault_core.dart' show PlaybackController;

const _kBackground = Color(0xFF0A0F1E);

void main() {
  // TODO(mobile): Replace these dev defaults with secure storage + a connection
  // screen once mobile connects to a real backend.
  const baseUrl = 'http://127.0.0.1:8999';
  const token = 'flutter-test-token';

  runApp(
    MultiProvider(
      providers: [
        Provider<LyricVaultApi>(
          create: (_) => LyricVaultApi(baseUrl: baseUrl, authToken: token),
        ),
        ChangeNotifierProvider<PlaybackController>(
          create: (_) => PlaybackController(authToken: token),
        ),
      ],
      child: const LyricVaultApp(),
    ),
  );
}

class LyricVaultApp extends StatelessWidget {
  const LyricVaultApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LyricVault Mobile',
      theme: ThemeData(
        brightness: Brightness.dark,
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.amber,
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: _kBackground,
      ),
      home: const LibraryPage(),
    );
  }
}

class LibraryPage extends StatefulWidget {
  const LibraryPage({super.key});

  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  List<Song> _songs = const [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadLibrary();
  }

  Future<void> _loadLibrary() async {
    setState(() => _isLoading = true);
    try {
      final api = context.read<LyricVaultApi>();
      final songs = await api.fetchLibrary();
      setState(() {
        _songs = songs;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading library: $e')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final player = context.watch<PlaybackController>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('LyricVault'),
      ),
      body: Stack(
        children: [
          _isLoading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _loadLibrary,
                  child: ListView.builder(
                    padding: EdgeInsets.only(
                      bottom: player.currentSong == null ? 0 : 96,
                    ),
                    itemCount: _songs.length,
                    itemBuilder: (context, index) {
                      final song = _songs[index];
                      return ListTile(
                        leading: song.coverUrl != null
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: Image.network(
                                  song.coverUrl!,
                                  width: 50,
                                  height: 50,
                                  fit: BoxFit.cover,
                                ),
                              )
                            : const Icon(Icons.music_note),
                        title: Text(song.title),
                        subtitle: Text(song.artist),
                        onTap: () => context.read<PlaybackController>().playSong(song),
                      );
                    },
                  ),
                ),
          const _MiniPlayer(),
        ],
      ),
    );
  }
}

class _MiniPlayer extends StatelessWidget {
  const _MiniPlayer();

  @override
  Widget build(BuildContext context) {
    return Consumer<PlaybackController>(
      builder: (context, player, child) {
        final song = player.currentSong;
        if (song == null) return const SizedBox.shrink();

        final duration = player.duration ?? Duration.zero;
        final position = player.position;
        final maxMs = duration.inMilliseconds <= 0 ? 1.0 : duration.inMilliseconds.toDouble();

        return Align(
          alignment: Alignment.bottomCenter,
          child: Container(
            decoration: BoxDecoration(
              color: const Color(0xFF0F1630),
              border: Border(
                top: BorderSide(
                  color: Colors.white.withAlpha(20),
                ),
              ),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: SafeArea(
              top: false,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              song.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontWeight: FontWeight.w600),
                            ),
                            Text(
                              song.artist,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.onSurface.withAlpha(179),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: player.isPlaying ? 'Pause' : 'Play',
                        onPressed: () => player.togglePlayPause(),
                        icon: Icon(player.isPlaying ? Icons.pause : Icons.play_arrow),
                      ),
                    ],
                  ),
                  Slider(
                    value: position.inMilliseconds.clamp(0, maxMs.toInt()).toDouble(),
                    max: maxMs,
                    onChanged: (v) => player.seek(Duration(milliseconds: v.round())),
                  ),
                  if (player.lastError != null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        player.lastError!,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                          fontSize: 12,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
