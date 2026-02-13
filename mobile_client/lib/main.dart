import 'package:flutter/material.dart';
import 'api_client.dart';
import 'models.dart';

void main() {
  runApp(const LyricVaultApp());
}

class LyricVaultApp extends StatelessWidget {
  const LyricVaultApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LyricVault Mobile',
      theme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.amber,
        scaffoldBackgroundColor: const Color(0xFF0A0F1E),
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
  late LyricVaultApi _api;
  List<Song> _songs = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    // Using default test values from our standalone verification
    _api = LyricVaultApi(
      baseUrl: 'http://127.0.0.1:8999',
      authToken: 'flutter-test-token',
    );
    _loadLibrary();
  }

  Future<void> _loadLibrary() async {
    setState(() => _isLoading = true);
    try {
      final songs = await _api.fetchLibrary();
      setState(() {
        _songs = songs;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading library: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('LyricVault'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadLibrary,
              child: ListView.builder(
                itemCount: _songs.length,
                itemBuilder: (context, index) {
                  final song = _songs[index];
                  return ListTile(
                    leading: song.coverUrl != null
                        ? Image.network(song.coverUrl!, width: 50, height: 50, fit: BoxFit.cover)
                        : const Icon(Icons.music_note),
                    title: Text(song.title),
                    subtitle: Text(song.artist),
                    onTap: () {
                      // Navigate to details or play
                    },
                  );
                },
              ),
            ),
    );
  }
}
