import 'package:equatable/equatable.dart';
import '../error/failures.dart';

/// Functional Result wrapper to avoid external dartz dependency while enforcing Clean Architecture error handling.
class Result<T> extends Equatable {
  final T? data;
  final Failure? failure;

  const Result._({this.data, this.failure});

  factory Result.success(T data) => Result._(data: data);
  factory Result.failure(Failure failure) => Result._(failure: failure);

  bool get isSuccess => failure == null;
  bool get isFailure => failure != null;

  R fold<R>(R Function(Failure failure) onFailure, R Function(T data) onSuccess) {
    if (failure != null) {
      return onFailure(failure!);
    }
    return onSuccess(data as T);
  }

  @override
  List<Object?> get props => [data, failure];
}

abstract class UseCase<Type, Params> {
  Future<Result<Type>> call(Params params);
}

class NoParams extends Equatable {
  const NoParams();

  @override
  List<Object?> get props => [];
}
