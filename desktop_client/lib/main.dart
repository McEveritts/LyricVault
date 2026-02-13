import 'dart:async';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:lyricvault_core/lyricvault_core.dart';
import 'package:provider/provider.dart';

import 'backend/backend_instance.dart';
import 'backend/backend_supervisor.dart';

const _kBackground = Color(0xFF0A0F1E);
const _kMiniPlayerBg = Color(0xFF0F1630);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const LyricVaultDesktopBootstrap());
}

class LyricVaultDesktopBootstrap extends StatefulWidget {
  const LyricVaultDesktopBootstrap({super.key});

  @override
  State<LyricVaultDesktopBootstrap> createState() => _LyricVaultDesktopBootstrapState();
}

class _LyricVaultDesktopBootstrapState extends State<LyricVaultDesktopBootstrap> {
  Future<BackendInstance>? _backendFuture;
  BackendInstance? _backend;

  @override
  void initState() {
    super.initState();
    _backendFuture = _startBackend();
  }

  Future<BackendInstance> _startBackend() async {
    final backend = await BackendSupervisor.start(
      timeout: const Duration(seconds: 30),
    );
    _backend = backend;
    return backend;
  }

  Future<void> _retry() async {
    final previous = _backend;
    _backend = null;
    await previous?.stop();

    setState(() {
      _backendFuture = _startBackend();
    });
  }

  Future<void> _quit() async {
    final backend = _backend;
    _backend = null;
    await backend?.stop();
    exit(1);
  }

  @override
  void dispose() {
    final backend = _backend;
    if (backend != null) unawaited(backend.stop());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'LyricVault Desktop',
      theme: ThemeData(
        brightness: Brightness.dark,
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.amber,
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: _kBackground,
      ),
      home: FutureBuilder<BackendInstance>(
        future: _backendFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const _StartingBackendScreen();
          }

          if (snapshot.hasError) {
            return _BackendFailedScreen(
              error: snapshot.error ?? 'Unknown error',
              onRetry: _retry,
              onQuit: _quit,
            );
          }

          final backend = snapshot.data!;
          return MultiProvider(
            providers: [
              Provider<BackendInstance>.value(value: backend),
              Provider<LyricVaultApi>(
                create: (_) => LyricVaultApi(
                  baseUrl: backend.baseUrl,
                  authToken: backend.token,
                ),
              ),
              ChangeNotifierProvider<PlaybackController>(
                create: (_) => PlaybackController(authToken: backend.token),
              ),
            ],
            child: const LibraryPage(),
          );
        },
      ),
    );
  }
}

class _StartingBackendScreen extends StatelessWidget {
  const _StartingBackendScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Starting LyricVault backend...',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                const LinearProgressIndicator(),
                const SizedBox(height: 12),
                const Text(
                  'LyricVault Desktop requires the local FastAPI backend. '
                  'If startup fails, the app will exit instead of running without a backend.',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _BackendFailedScreen extends StatelessWidget {
  final Object error;
  final Future<void> Function() onRetry;
  final Future<void> Function() onQuit;

  const _BackendFailedScreen({
    required this.error,
    required this.onRetry,
    required this.onQuit,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LyricVault')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 900),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Backend failed to start',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 8),
              const Text(
                'LyricVault Desktop will not run without the backend. '
                'Fix the backend issue and retry.',
              ),
              const SizedBox(height: 16),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.black26,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: SelectableText(
                    error.toString(),
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  FilledButton.icon(
                    onPressed: () async => onRetry(),
                    icon: const Icon(Icons.refresh),
                    label: const Text('Retry'),
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    onPressed: () async => onQuit(),
                    icon: const Icon(Icons.close),
                    label: const Text('Quit'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
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
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _isLoading ? null : _loadLibrary,
            icon: const Icon(Icons.refresh),
          ),
        ],
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
                      final coverUrl = (song.coverUrl ?? '').trim();

                      return ListTile(
                        leading: coverUrl.isNotEmpty
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: CachedNetworkImage(
                                  imageUrl: coverUrl,
                                  width: 48,
                                  height: 48,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => const SizedBox(
                                    width: 48,
                                    height: 48,
                                    child: DecoratedBox(
                                      decoration: BoxDecoration(color: Colors.black26),
                                      child: Center(
                                        child: SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(strokeWidth: 2),
                                        ),
                                      ),
                                    ),
                                  ),
                                  errorWidget: (context, url, error) => const Icon(Icons.music_note),
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
              color: _kMiniPlayerBg,
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
