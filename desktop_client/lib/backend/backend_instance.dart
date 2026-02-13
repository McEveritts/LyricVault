import 'dart:io';

class BackendInstance {
  final String baseUrl;
  final String token;
  final int port;
  final Process process;

  BackendInstance({
    required this.baseUrl,
    required this.token,
    required this.port,
    required this.process,
  });

  Future<void> stop({Duration timeout = const Duration(seconds: 3)}) async {
    if (process.pid <= 0) return;

    // Best-effort graceful stop.
    process.kill(ProcessSignal.sigterm);

    final exited = await process.exitCode.timeout(timeout, onTimeout: () => -1);
    if (exited == -1) {
      process.kill(ProcessSignal.sigkill);
    }
  }
}

