import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'backend_instance.dart';

class BackendSupervisor {
  static Future<BackendInstance> start({
    Duration timeout = const Duration(seconds: 15),
  }) async {
    final repoRoot = _findRepoRoot();
    final backendScript = File('${repoRoot.path}${Platform.pathSeparator}backend${Platform.pathSeparator}main.py');
    if (!backendScript.existsSync()) {
      throw Exception('Missing backend script: ${backendScript.path}');
    }

    final pythonExe = _resolvePythonExe(repoRoot);
    if (pythonExe == null) {
      throw Exception(
        'Could not find a Python interpreter. Run the desktop setup (or install Python) and retry.',
      );
    }

    final port = await _pickPort();
    final token = _randomHex(32);
    final baseUrl = 'http://127.0.0.1:$port';

    final env = Map<String, String>.from(Platform.environment);
    env['LYRICVAULT_BACKEND_PORT'] = port.toString();
    env['LYRICVAULT_API_TOKEN'] = token;
    env['LYRICVAULT_APP_VERSION'] = '0.5.0-desktop';

    late final Process process;
    try {
      process = await Process.start(
        pythonExe,
        [backendScript.path],
        workingDirectory: backendScript.parent.path,
        environment: env,
        runInShell: false,
      );
    } on ProcessException catch (e) {
      throw Exception('Failed to start backend ($pythonExe): ${e.message}');
    }

    // Pipe backend logs into the Flutter process output for debugging.
    unawaited(process.stdout.transform(utf8.decoder).forEach((chunk) {
      stdout.write('[backend] $chunk');
    }));
    unawaited(process.stderr.transform(utf8.decoder).forEach((chunk) {
      stderr.write('[backend] $chunk');
    }));

    final ready = await _waitForBackend(
      baseUrl: baseUrl,
      token: token,
      timeout: timeout,
      process: process,
    );

    if (!ready) {
      try {
        process.kill(ProcessSignal.sigkill);
      } catch (_) {}
      throw Exception('Backend failed to start within ${timeout.inSeconds}s');
    }

    return BackendInstance(
      baseUrl: baseUrl,
      token: token,
      port: port,
      process: process,
    );
  }

  static Directory _findRepoRoot() {
    var dir = Directory.current.absolute;
    while (true) {
      final candidate = File('${dir.path}${Platform.pathSeparator}backend${Platform.pathSeparator}main.py');
      if (candidate.existsSync()) return dir;
      final parent = dir.parent;
      if (parent.path == dir.path) break;
      dir = parent;
    }
    return Directory.current.absolute;
  }

  static String? _resolvePythonExe(Directory repoRoot) {
    final venvPython = File(
      '${repoRoot.path}${Platform.pathSeparator}backend${Platform.pathSeparator}venv${Platform.pathSeparator}Scripts${Platform.pathSeparator}python.exe',
    );
    if (venvPython.existsSync()) return venvPython.path;

    // Fallback: rely on PATH if Python is installed globally.
    return 'python';
  }

  static Future<int> _pickPort() async {
    final socket = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
    final port = socket.port;
    await socket.close();
    return port;
  }

  static String _randomHex(int bytes) {
    final rng = Random.secure();
    final data = List<int>.generate(bytes, (_) => rng.nextInt(256));
    final sb = StringBuffer();
    for (final b in data) {
      sb.write(b.toRadixString(16).padLeft(2, '0'));
    }
    return sb.toString();
  }

  static Future<bool> _waitForBackend({
    required String baseUrl,
    required String token,
    required Duration timeout,
    required Process process,
  }) async {
    final http = HttpClient()..connectionTimeout = const Duration(seconds: 1);
    var exited = false;
    unawaited(process.exitCode.then((_) => exited = true));
    final deadline = DateTime.now().add(timeout);

    while (DateTime.now().isBefore(deadline)) {
      if (exited) return false;

      try {
        final req = await http.getUrl(Uri.parse('$baseUrl/'));
        req.headers.set('X-LyricVault-Token', token);
        final res = await req.close();
        if (res.statusCode == 200) {
          http.close(force: true);
          return true;
        }
      } catch (_) {
        // Retry.
      }

      await Future<void>.delayed(const Duration(milliseconds: 500));
    }

    http.close(force: true);
    return false;
  }
}
