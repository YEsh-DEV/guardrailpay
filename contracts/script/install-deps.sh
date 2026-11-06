#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
install_pinned() {
  local directory="$1" repository="$2" commit="$3"
  if [ ! -d "$directory/.git" ]; then
    git clone "$repository" "$directory"
    git -C "$directory" checkout --detach "$commit"
  fi
  test "$(git -C "$directory" rev-parse HEAD)" = "$commit"
  test -z "$(git -C "$directory" status --porcelain)"
}
mkdir -p lib
install_pinned lib/openzeppelin-contracts https://github.com/OpenZeppelin/openzeppelin-contracts.git dbb6104ce834628e473d2173bbc9d47f81a9eec3
install_pinned lib/forge-std https://github.com/foundry-rs/forge-std.git 77041d2ce690e692d6e03cc812b57d1ddaa4d505
