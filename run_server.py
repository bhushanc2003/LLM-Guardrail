import socket
import uvicorn

def main():
    sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        # Dual-stack: accepts both IPv6 (::1) and IPv4 (127.0.0.1) on macOS/Linux
        sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
    except (AttributeError, OSError):
        pass
    sock.bind(('::', 8000))
    sock.listen(128)

    print("🚀 Dual-stack server listening on [::]:8000 (accessible via localhost, 127.0.0.1, and [::1])")

    config = uvicorn.Config(
        "pii_proxy.main:app",
        reload=True,
        reload_dirs=["pii_proxy"],
        log_level="info"
    )
    server = uvicorn.Server(config)
    server.run(sockets=[sock])

if __name__ == "__main__":
    main()
